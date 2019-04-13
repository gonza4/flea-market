var session = require("../db/index");

module.exports.getProductById = function(id) {
	return session
		.run(
			`MATCH (p:Product) 
			 WHERE ID(p) = ${id}
			 RETURN p`
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

			return node;
		})
		.catch(function(e){
			console.log(e);
			return e;
		});
}