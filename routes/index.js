var express = require('express');
var router = express.Router();

router.get('/', ensureAuthenticated, function(req, res){
	if(req.query.access !== undefined) {

    res.send(true);
  }
	else {
    res.send(false);
  }
});

function ensureAuthenticated(req, res, next){
	if(req.isAuthenticated() || req.session.access_token != 'undefined'){
		return next();
	}
	else{
		res.redirect('/#/');
	}
}

module.exports = router;