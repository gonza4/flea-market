var bcrypt = require('bcryptjs');
var neo4j = require('neo4j-driver').v1;

var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', 'root'));
var session = driver.session();

var User = module.exports = function User(_node) {
	// all we'll really store is the node; the rest of our properties will be
	// derivable or just pass-through properties.
	this._node = _node;
}

module.exports.getUserByUsername = function(username, callback){
	session
		.run('MATCH (p:User { username: $username })RETURN p',
		{username: username}
		)
		.then(function(result){
			session.close();
			var singleRecord = result.records[0];

			if(singleRecord !== undefined){
				var node = singleRecord._fields[0].properties;
			}
			else{
				var node = null;
			}

			callback(null, node);
			// driver.close();
		})
		.catch(function(err){
			return err;
		});
}

module.exports.getSteemData = function(req, callback){
	var sessionStore = req.sessionStore.sessions;
	var steemData = null;
	for (var i in sessionStore){
		var steemSession = JSON.parse(sessionStore[i]);
		steemData = steemSession['steemconnect'];
	}

	callback(null, steemData);
}

module.exports.getUserByFacebookId = function(facebookId, callback){
	session
		.run('MATCH (p:User { facebookId: $facebookId })RETURN p',
		{facebookId: facebookId}
		)
		.then(function(result){
			session.close();
			var singleRecord = result.records[0];

			if(singleRecord !== undefined){
				var node = singleRecord._fields[0].properties;
			}
			else{
				var node = null;
			}

			callback(null, node);
			// driver.close();
		})
		.catch(function(err){
			return err;
		});
}

module.exports.getUserByGoogleId = function(googleId, callback){
	session
		.run('MATCH (p:User { googleId: $googleId })RETURN p',
		{googleId: googleId}
		)
		.then(function(result){
			session.close();
			var singleRecord = result.records[0];

			if(singleRecord !== undefined){
				var node = singleRecord._fields[0].properties;
			}
			else{
				var node = null;
			}

			callback(null, node);
			// driver.close();
		})
		.catch(function(err){
			return err;
		});
}

module.exports.getUserBySteemId = function(steemId, callback){
	session
		.run('MATCH (p:User { steemId: $steemId })RETURN p',
			{
				steemId
			}
		)
		.then(function(result){
			session.close();
			var singleRecord = result.records[0];

			if(singleRecord !== undefined){
				var node = singleRecord._fields[0].properties;
			}
			else{
				var node = null;
			}

			callback(null, node);
			// driver.close();
		})
		.catch(function(err){
			// console.log(err);
			return err;
		});
}

module.exports.getSteemUserByUsername = function(username, callback){
	session
		.run(`MATCH (u:User { username: '${username}' }) WHERE EXISTS (u.steemId) RETURN u`
		)
		.then(function(result){
      console.log('Result')
      console.log(result)
			session.close();
			var singleRecord = result.records[0];
			if(singleRecord !== undefined){
				var node = singleRecord._fields[0].properties;
			}
			else{
				var node = null;
			}

			callback(null, node);
			// driver.close();
		})
		.catch(function(err){
			console.log(err);
      callback(err, null)
			return err;
		});
}

module.exports.comparePassword = function(password, hash, callback){
	bcrypt.compare(password, hash, function(err, isMatch){
		if(err) throw err;
		callback(null, isMatch);
	});
}

module.exports.getSteemConnectProfile = function(req) {
  var aux = req.sessionStore.sessions;
  let result;
  for (var i in aux) {
    var aux_ses = JSON.parse(aux[i]);
    if (aux_ses['steemconnect']) {
      result = aux_ses['steemconnect'];
    }
  }

  return result;
}