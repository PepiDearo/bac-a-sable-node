# Guide d’Authentification en Node.js

FIXME : Expliquer davantage le fonctionnement des Hash.

Ce tutoriel explique comment mettre en place un système d’authentification avec
[Node.js](https://nodejs.org), [Express](https://expressjs.com/) et
[SQLite](https://www.sqlite.org/index.html) via [Knex](http://knexjs.org/).

Nous utilisons [bcryptjs](https://www.npmjs.com/package/bcryptjs) pour le
**hashage** et [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) pour
la **génération** de tokens.

## 1. Configuration et initialisation

Dans votre fichier `index.js`, vous devez tout d’abord configurer un serveur
Express et initialiser une base de données SQLite avec Knex. Ici, la base
SQLite s’appuie sur un fichier local. Nous utilisons
`db.schema.createTable('users', ...)` pour créer la table `users`:

```javascript
const express = require('express');
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('knex');

app.use(express.json());

// Initialiser la connexion à la base de données avec Knex
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './database.sqlite'
  },
  useNullAsDefault: true
});

// Initialisation de la table "users" si elle n'existe pas
db.schema.hasTable('users').then(exists => {
  if (!exists) {
    return db.schema.createTable('users', table => {
      table.increments('id').primary();
      table.string('email').unique();
      table.string('password');
    });
  }
});
```

## 2. Hashage du mot de passe

Le hashage consiste à transformer un mot de passe en une empreinte
cryptographique (hash).

### 2.1. Création d’un utilisateur

On utilise `bcrypt.hash()` pour obtenir cette empreinte avant de stocker le mot
de passe dans la base :

```javascript
// ...code...
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  // ...code...
  // Générer le hash du mot de passe
  const saltRounds = 10; // plus c’est élevé, plus c’est lent mais plus c’est sécurisé
  const hash = await bcrypt.hash(password, saltRounds);
  // ...code...
  await db('users').insert({ email, password: hash });
  // ...code...
});
```

Grâce à l’algorithme de `bcrypt`, même si quelqu’un accède à votre base de
données, il n’aura pas directement les mots de passe en clair. J'insiste sur le
fait que le hashage est une étape cruciale pour sécuriser les mots de passe.
Ne **jamais** stocker les mots de passe en clair dans une base de données !

Les hash de `bcrypt` sont générés avec un sel aléatoire, ce qui les rend
difficiles à casser. Dans la base de données, ils ressemblent à ceci
 `$2b$10$ZMH.n4pX/OR4ZF4iKyhHYuWrSVuX52M8xCrswJlyZPOuxiTowCBXu`

### 2.2. Vérification du mot de passe

Pour vérifier un mot de passe, on utilise `bcrypt.compare()` pour comparer le
mot de passe en clair avec le hash stocké en base :

```javascript
// ...code...
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  // ...code...
  // Chercher l'utilisateur dans la base
  const user = await db('users').where({ email }).first();
  // ...code...
  // Comparer le mot de passe en clair avec le hash
  const isMatch = await bcrypt.compare(password, user.password);
```

Si le mot de passe est correct, `isMatch` sera `true`. Sinon, il sera `false`.
Encore une fois, le mot de passe en clair n’est jamais stocké en base.

### 2.3. Ne pas réinventer la roue

Il est important d'utiliser des bibliothèques de confiance pour le hashage des
mots de passe. `bcrypt` est une bibliothèque bien établie et largement utilisée
pour cette tâche. Ne tentez pas de créer votre propre algorithme de hashage. La
cryptographie est un domaine complexe et il est facile de faire des erreurs qui
peuvent compromettre la sécurité de votre application.

Par exemple vous pourriez être victime d'une [attaque
temporelle](https://en.wikipedia.org/wiki/Timing_attack) si vous comparez les
mots de passe caractère par caractère.

## 3. Génération d’un token JWT

Lorsqu’un utilisateur se connecte, nous devons générer un **token** pour
représenter sa session. Ainsi, le client peut ensuite l’utiliser pour prouver
son identité. Nous utilisons `jsonwebtoken` et une clé secrète pour signer ce
token :

```javascript
// ...code...
const SECRET_KEY = 'ma-cle-tres-secrete';
// ...code...
app.post('/login', async (req, res) => {
  // ...code...
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    SECRET_KEY,
    { expiresIn: '1h' }
  );
  // ...code...
});
```

Ce token encodé contient des informations sur l’utilisateur et peut être envoyé
au client avec un simple JSON. *Évidemment, en production, vous devez stocker
cette clé secrète dans un fichier de configuration ou dans une variable
d’environnement.*

## 4. Vérification du token (Middleware)

Pour protéger certaines routes, vous allez devoir vérifier la validité du token
à chaque requête. L’exemple ci-dessous montre un middleware `verifyToken` qui
s’occupe de décoder et de valider le token :

```javascript
// ...code...
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // ...code...
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide ou expiré.' });
    }
    req.user = decoded;
    next();
  });
}
// ...code...
```

Si le token est invalide, on renvoie une erreur. Sinon, on attache le contenu
du token à `req.user`.

## 5. Récupération du profil

Exemple typique de route protégée : /profile. Elle appelle `verifyToken` pour
autoriser l’accès:

```javascript
// ...code...
app.get('/profile', verifyToken, async (req, res) => {
  // ...code...
  res.json({
    id: user.id,
    email: user.email,
    message: 'Vous êtes authentifié !',
    token_used: token
  });
});
```

Si tout se passe bien, l’utilisateur authentifié reçoit ses informations de
profil et le **token** utilisé.

## Conclusion

En résumé :

1. **Hashage** : on transforme le mot de passe avec `bcrypt`.
2. **Génération de token** : à la connexion, on signe le token JWT avec `jsonwebtoken`.
3. **Vérification** : on décode le token pour protéger les routes sensibles (via `verifyToken`).

Cette approche sécurise vos routes, car seules les personnes ayant un token
valide peuvent accéder à des ressources protégées. Les tokens JWT sont
particulièrement utiles pour les applications RESTful, car ils sont auto-suffisants
et ne nécessitent pas de stockage côté serveur. Votre application est donc stateless.
