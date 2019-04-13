var sc2 = require('sc2-sdk');
var configAuth = require('./auth');

var scApi = sc2.Initialize({
  	app: configAuth.steemAuth.clientID,
	callbackURL: configAuth.steemAuth.callbackURL,
	scope: ['login', 'vote', 'comment'],
});

module.exports = scApi;
