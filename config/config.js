exports.genMailSubject = (name, title) => `A l'attention de ${title} ${name}`;
exports.genMailTxtBody = (name, title) => `${title} le Maire,

Je me permets de vous contacter à nouveau en tant que fondateur de Dartagnans.fr, la première plateforme française de financement participatif dédiée au rayonnement et à la préservation du patrimoine culturel.
 
Depuis son lancement en septembre 2015, Dartagnans a eu la chance d'accompagner 95 porteurs de projets pour plus de 700 000€ de dons collectés.
 
Je souhaiterais vous proposer d'échanger sur les synergies que nous pourrions créer ensemble, et vous présenter plus en détail les services d'accompagnement sur-mesure proposés par Dartagnans et notre impact sur le patrimoine et le mécénat en France.
 
En effet, Dartagnans est identifié comme une startup qui transforme l'image du patrimoine et du mécénat, avec plus de 2 millions de personnes atteintes chaque mois sur Facebook. Cela permet à nos porteurs de projets de toucher un nouveau public comme les jeunes et les citoyens en quête d'expériences culturelles.
 
Nous attachons beaucoup d'importance à faire de nos campagnes de véritables opérations de communication au-delà de la levée de fonds.

Je reste à votre disposition pour tout complément d'information ou rendez-vous que vous voudriez bien m'accorder, et je vous prie de croire, ${title} le Maire, en l'expression de ma respectueuse considération.
`;

exports.CSV_FILE = 'test.csv'; // 'Mairies.csv';
exports.GMAIL_USER = ;
exports.CLIENT_ID = ;
exports.CLIENT_SECRET = ;
exports.REFRESH_TOKEN = ;
exports.ACCESS_TOKEN = ;
exports.attachments = [{path: './Dartagnans_x_Collectivité_Territoriale.pdf'}]
