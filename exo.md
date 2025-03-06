# Exercice

Modifier le fichier `index.js` pour ajouter les fonctionnalités suivantes :

- Ajouter une table `user_color` pour la couleur préférée de chaque utilisateur avec comme colonnes :
    - userid : int
    - couleur : texte

- Ajouter une route pour ajouter une couleur préférée à un utilisateur. Vérifier le jeton d'authentification. Tester avec une requette dans le fichier `request.http`. Attention, le userid
du jeton n'est pas celui de l'utilisateur à qui on veut ajouter la couleur. Vous pouvez imaginer que
le jeton appartient à un admin qui peut ajouter des couleurs à tous les utilisateurs.

    - POST /users/:userid/color
    - { "color": "blue" }
    - Retourner 200 si la couleur a été ajoutée, 400 sinon

- Ajouter une route pour récupérer la couleur préférée d'un utilisateur. NE PAS vérifier le jeton d'authentification. Tester avec une requette dans le fichier `request.http`.
    - GET /users/:userid/color
    - Retourner 200 et la couleur (format JSON) si elle existe, 404 sinon
