var express = require("express");
var router = express.Router();
var session = require("../db/index");

var Product = require("../models/product");
var User = require("../models/user");

function notNull(value) {
  return value !== null && value !== 'null'
}

function notUndefined(value) {
  return value !== undefined && value !== 'undefined'
}

router.get('/search', async(req, res) => {
	var name = req.query.name;
  var category = req.query.category;
	const page = req.query.page;
  const limit = req.query.limit;

	// if(name){
		const result = await getProductSearch({name, page, limit, category});

		res.send(result);
	// }
});

async function getProductSearch({name, page = 1, limit = 12, category = null}){
	page = parseInt(page);
  limit = parseInt(limit);
  page = page < 1 ? 1 : page;
  page = page != 1 ? limit : page - 1;

  let query = 'MATCH (p:Product)';

  if (notUndefined(category) && notNull(category)) {
    query += ` WHERE p.category = $category`;
  }

  if (notUndefined(name) && notNull(name)) {
    query += (notUndefined(category) && notNull(category))
      ? ` AND toLower(p.name) CONTAINS '${name.toLowerCase()}'`
      : ` WHERE toLower(p.name) CONTAINS '${name.toLowerCase()}'`;
  }

  let countQuery = query + ' RETURN COUNT(p)'

  console.log('browser')
  console.log(countQuery)

  const count = await session
    .run(countQuery, { category })
    .then(function(result) {
      console.log('a')
      session.close();
      return result.records[0];
    });

  var finalCount = 0;

  if (count.length > 0) {
    finalCount = count._fields[0].low;
  }

  let resultsQuery = query + ' RETURN DISTINCT p';

	const search = await session
		.run(resultsQuery, { category })
		.then(function(result){
			session.close();
			var total = [];
      for (i in result.records) {
        let id = result.records[i]._fields[0].identity.low;
        total.push({
          ...result.records[i]._fields[0].properties,
          count: finalCount,
          id
        });
      }
      return total;
		})
		.catch(function(e){
			console.log(e);
			return e;
		});
	return search;
}


module.exports = router;