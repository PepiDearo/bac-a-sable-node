const express = require('express');
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('knex');

// Pour lire le corps des requêtes JSON
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

// On définit une clé secrète qui servira à signer nos tokens (voir plus bas)
// En pratique, il est recommandé de générer une clé aléatoire et de la stocker
// dans une variable d'environnement pour ne pas la rendre publique
const SECRET_KEY = 'ma-cle-tres-secrete';


// Middleware pour vérifier le token
function verifyToken(req, res, next) {
    // Vérifier si le token est dans l'entête Authorization
    const authHeader = req.headers['authorization'];
  
    if (!authHeader) {
      return res.status(401).json({ message: 'Token manquant.' });
    }
  
    // Le token est souvent envoyé sous forme "Bearer <token>", on le split
    const token = authHeader.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ message: 'Token manquant.' });
    }
  
    console.log('Token utilisé :', token);

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) {
        // Le token n’est pas valide ou a expiré
        return res.status(403).json({ message: 'Token invalide ou expiré.' });
      }
  
      // Décodé contient { userId: ..., email: ..., iat: ..., exp: ... }
      req.user = decoded; // On attache l’info décodée à l’objet req
      console.log('Token décodé :', decoded);
      next();             // On passe au prochain middleware ou route
    });
  }

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Vérifications minimales
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis.' });
  }

  try {
    // Générer le hash du mot de passe
    const saltRounds = 10; // plus c’est élevé, plus c’est lent mais plus c’est sécurisé
    const hash = await bcrypt.hash(password, saltRounds);

    // Insérer dans la BD
    await db('users').insert({ email, password: hash });

    // L’utilisateur est enregistré
    res.status(201).json({ message: 'Utilisateur enregistré avec succès !' });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Erreur interne.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis.' });
  }

  try {
    // Chercher l'utilisateur dans la base
    const user = await db('users').where({ email }).first();

    if (!user) {
      // Pas d’utilisateur avec cet email
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    // Comparer le mot de passe en clair avec le hash
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Mot de passe incorrect
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email }, // informations qu’on veut inclure dans le token
      SECRET_KEY,                           // clé secrète
      { expiresIn: '1h' }                   // durée de validité du token
    );

    console.log('Utilisateur authentifié :', user.email);
    console.log('Token généré :', token);

    // Envoyer le token au client
    res.status(200).json({ token });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Erreur interne.' });
  }
});


app.get('/profile', verifyToken, async (req, res) => {
  // On récupère userId depuis le token
  const userId = req.user.userId;

  try {
    // Chercher en base les infos de l’utilisateur
    const user = await db('users').where({ id: userId }).first();

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // Retrouve le token utilisé
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];

    res.json({
      id: user.id,
      email: user.email,
      message: 'Vous êtes authentifié !',
      token_used: token
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur interne.' });
  }
});


app.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});
