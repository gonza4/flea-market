var express = require('express');
var router = express.Router();
var session = require('../db/index');

var Product = require('../models/product');
var User = require('../models/user');

function notUndefined(variable) {
  return variable !== undefined && variable !== 'undefined';
}

function setValueOrProperty(key, value, object) {
  if (notUndefined(value[key])) {
    return value[key]
  }

  if (notUndefined(object[key])) {
    return object[key]
  }

  return null
}

// Create a new Store for the current steem user
router.post('/add', async(req, res) => {
	const result = User.getSteemConnectProfile(req);

	if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        var store = await createStore(user, req);
        res.send(store);
      });
    }catch(e){
      console.log(e);
    }
  }
});

async function createStore(user, req){
  if(user){
    let name = req.body.name;
    let description = req.body.description;
    let steemId = user.steemId;

    const store = await session
      .run(
        `MATCH p =(s:Store)-[r:HAS_STORE]-(u:User)
         WHERE u.steemId = ${steemId}
         RETURN p`
      )
      .then(function(result){
        let singleRecord = result.records[0];

        if(singleRecord === undefined){
          return session
            .run(
              `CREATE (s:Store {
                name: $name,
                description: $description
              }) RETURN s`,
              {
                name,
                description
              }
            )
            .then(function(result){
              let singleRecord = result.records[0];
              let node = singleRecord._fields[0].properties;
              let storeId = singleRecord._fields[0].identity;

              session.run(
                `MATCH (u:User), (s:Store)
                 WHERE u.steemId = ${steemId}
                 AND ID(s) = ${storeId}
                 CREATE (u)-[r:HAS_STORE]->(s)
                 RETURN type(r)`
              )
              .then(function(result){
              })
              .catch(function(e){
                console.log(e);
              });

              session.close();
              return node;
            })
            .catch(function(e){
              console.log(e);
              return e;
            });
        }
        else{
          return false;
        }
      })
      .catch(function(e){
        console.log(e);
      });
    return store;
  }
  else{
    return false;
  }
}

router.post('/edit', async(req, res) => {
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        var store = await editStore(user, req);
        res.send(store);
      });
    }catch(e){
      console.log(e);
    }
  }
});

async function editStore(user, req){
  if(user){
    const steemId = user.steemId;
    const store = await session
      .run(
        `MATCH (u:User { steemId: ${steemId} })-- (s:Store) RETURN s`
      )
      .then(function(result){
        let singleRecord = result.records[0];

        if(singleRecord != null){
          let properties = singleRecord._fields[0].properties;

          let name = setValueOrProperty('name', req.body, properties);
          let description = setValueOrProperty('description', req.body, properties);
          let banner = setValueOrProperty('banner', req.body, properties);
          let avatar = setValueOrProperty('avatar', req.body, properties);
          // let active = req.body.active !== undefined ? req.body.active : properties.active;

          return session
            .run(
              `MATCH (u:User { steemId: ${steemId} })-- (s:Store)
               SET s.name = $name,
                   s.description = $description,
                   s.active = true,
                   s.banner = $banner,
                   s.avatar = $avatar
               RETURN s`,
               {
                name,
                description,
                banner,
                avatar
               }
            )
            .then(function(result){
              session.close();
              var singleRecord = result.records[0];
              var node = singleRecord._fields[0].properties;

              return node;
            })
            .catch(function(e){
              console.log(e);
              return e;
            });
        }
      })
      .catch(function(e){

      });
    return store;
  }
}

// get the store from a steem user
router.get('/get/user', async(req, res) => {
  if(req.query.steemUsername !== undefined){
    try{
      const username = req.query.steemUsername;

      User.getSteemUserByUsername(username, async(err, user) => {
        let store = await getStoreFromUser(user);
        res.send(store);
      });
    }catch(e){
      console.log(e);
      res.send(e);
    }
  }
  else{
    try{
      const result = User.getSteemConnectProfile(req);

      if(result === undefined){
        res.send(null);
      }
      else{
        User.getUserBySteemId(result.id, async(err, user) => {
          var store = await getStoreFromUser(user);

          res.send(store);
        });
      }
    }catch(e){
      console.log(e);
      res.send(e)
    }
  }
});

async function getStoreFromUser(user){
  if(user){
    const productListNames = await getProductListNames(user.steemId);
    const store = await session
      .run(
        "MATCH (u:User { steemId: $steemId })-- (s:Store) RETURN s",
        {
          steemId: user.steemId
        }
      )
      .then(function(result){
        session.close();
        let singleRecord = result.records[0];
        var total = [];
        let properties = singleRecord._fields[0].properties;

        for(i in productListNames){
          total.push({ productListNames: productListNames[i].productListName })
        }

        total.push({properties: {...properties, username: user.username}});
        return total;
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return store;
  }
  else{
    return null;
  }
}

// Add a product in a product list from current steem user Store
router.post('/product_list/:id', async(req, res) => {
  const result = User.getSteemConnectProfile(req);
  const id = req.params.id;
  const name = req.body.name;

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        var result = await addProductToProductListStore(id, user, name);
        res.send(result);
      });
    }catch(e){
      console.log(e);
    }
  }
});

async function addProductToProductListStore(id, user, name){
  if(user){
    let steemId = user.steemId;
    const product = await session
      .run(
        `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[i:HAS_STORE]-(u:User)
         WHERE u.steemId = ${steemId} AND ID(pr) = ${id} AND r.name = '${name}'
         RETURN p`
      )
      .then(function(result){
        let singleRecord = result.records[0];
        if(singleRecord === undefined){
          return session
            .run(
              `MATCH (u:User),(p:Product),(s:Store)
               WHERE u.steemId = ${steemId} AND ID(p) = ${id}
               CREATE (s)-[r:IN_PRODUCT_LIST { name: '${name}', date: datetime() } ]->(p)
               RETURN type(r)`
            )
            .then(function(result){
              session.close();
              return true;
            })
            .catch(function(e){
              console.log(e);
              return e;
            });
        }
        else{
          return false;
        }
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return product;
  }
  else{
    return false;
  }
}

// get products list from a steem user store
// if name is null get that product list, else get all products list
router.get('/product_list/get', async(req, res) => {
  const name = req.query.name;
  const result = await User.getSteemConnectProfile(req);

  if(result === undefined){
    if (req.query.userName !== undefined) {
      try {
        User.getSteemUserByUsername(req.query.userName, async(err, user) => {
          let result;
          try {
            var productList = await getProductListFromUser(user, name);

            result = productList;
          } catch(e) {
            console.log(e)
            result = e;
          }

          res.send(result)
        });
      } catch(e) {
        console.log(e);
        res.send(e);
      }
    }
    else {
      res.send(null);
    }
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        var productList = await getProductListFromUser(user, name);

        res.send(productList);
      });
    }catch(e){
      res.send('Error while getting product list')
      console.log(e);
    }
  }
});

async function getProductListFromUser(user, name){
  if(user){
    const steemId = user.steemId;
    const steemUsername = user.name
    if(name){
      let query = (steemUsername !== undefined)
        ? `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[i:HAS_STORE]-(u:User)
         WHERE u.name = '${steemUsername}' AND r.name = '${name}'
         RETURN pr`
        : `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[i:HAS_STORE]-(u:User)
         WHERE u.steemId = ${steemId} AND r.name = '${name}'
         RETURN pr`
      const productList = await session
        .run(
          query
        )
        .then(function(result){
          session.close();
          var total = [];
          for(i in result.records){
            total.push({ ...result.records[i]._fields[0].properties,
            id: result.records[i]._fields[0].identity.low,
            productList: true,
            productListName: name })
          }
          return total;
        })
        .catch(function(e){
          console.log(e);
          return e;
        })

      return productList;
    }
    else{
      return null;
    }
  }
  else{
    return null;
  }
}

// get all the products list names from a store, passing the steemId from the user by parameter
router.get('/product_list/get/names/:id', async(req, res) => {
  const userId = req.params.id;

  try{
    let productListNames = await getProductListNames(userId);

    res.send(productListNames);
  }catch(e){
    console.log(e);
    res.send(e)
  }
});

async function getProductListNames(steemId){
  const names = await session
    .run(
      `MATCH (p:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[i:HAS_STORE]-(u:User)
       WHERE u.steemId = ${steemId}
       RETURN DISTINCT r.name`
    )
    .then(function(result){
      session.close();
      var total = [];

      for(i in result.records){
        total.push({
        productListName: result.records[i]._fields[0] })
      }
      return total;
    })
    .catch(function(e){
      console.log(e);
      return e;
    });
  return names;
}

// if i get the id: delete the product relationship with product list
// else delete the complete product list from store
router.post('/product_list/delete/:id', async(req, res) => {
  const id = req.params.id;
  const name = req.query.name;
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(e, user) => {
        let product = await deleteProductFromProductList(id, name, user);

        res.send(product);
      });
    }catch(e){
      console.log(e);
      res.send(e)
    }
  }
});

async function deleteProductFromProductList(id, name, user){
  if(user){
    let steemId = user.steemId;
    if(id !== '0' && id !== 0){
      const product = await session
        .run(
          `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[t:HAS_STORE]-(u:User)
           WHERE u.steemId = ${steemId} AND ID(pr) = ${id} AND r.name = '${name}'
           DELETE r`
        )
        .then(function(result) {
          session.close();
          return true;
        })
        .catch(function(e) {
          console.log(e);
          return e;
        });
      return product;
    }
    else{
      const product = await session
        .run(
          `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[t:HAS_STORE]-(u:User)
           WHERE u.steemId = ${steemId} AND r.name = '${name}'
           DELETE r`
        )
        .then(function(result) {
          session.close();
          return true;
        })
        .catch(function(e) {
          console.log(e);
          return e;
        });
      return product;
    }
  }
  else{
    return false;
  }
}

// update a product list name
// receives a list name to find the list and a final name that replaces the original
router.post('/product_list/name/edit', async(req, res) => {
  const listName = req.body.listName;
  const finalName = req.body.finalName;
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(e, user) => {
        let productList = await editProductList(listName, finalName, user);

        res.send(productList);
      });
    }catch(e){
      console.log(e);
      res.send(e)
    }
  }
});

async function editProductList(listName, finalName, user){
  if(user){
    const steemId = user.steemId;
    const product = await session
      .run(
        `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[t:HAS_STORE]-(u:User)
         WHERE u.steemId = ${steemId} AND r.name = '${listName}'
         RETURN r`
      )
      .then(function(result){
        let singleRecord = result.records[0];

        if(singleRecord != null){
          let properties = singleRecord._fields[0].properties;

          let name = finalName !== undefined ? finalName : properties.name;

          return session
            .run(
              `MATCH p =(pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[t:HAS_STORE]-(u:User)
               WHERE u.steemId = ${steemId} AND r.name = '${listName}'
               SET r.name = '${finalName}'
               RETURN r`
            )
            .then(function(result){
              session.close();
              var singleRecord = result.records[0];
              var node = singleRecord._fields[0].properties;

              return node;
            })
            .catch(function(e){
              console.log(e);
              return e;
            });
        }
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return product;
  }
}

// add product to offers
router.post('/offers/add/:id', async(req, res) => {
  const id = req.params.id;
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        let offer = await addProductToOffers(id, user);

        res.send(offer);
      });
    }catch(e){
      console.log(e);
    }
  }
});

async function addProductToOffers(id, user){
  if(user){
    const steemId = user.steemId;
    const offer = await session
      .run(
        `MATCH (u:User), (s:Store), (p:Product)
         WHERE u.steemId = ${steemId} AND ID(p) = ${id}
         CREATE (s)-[r:IN_OFFER { date: datetime() }]->(p)
         RETURN type(r)`
      )
      .then(function(result){
        session.close();
        return true;
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return offer;
  }
  else{
    return false;
  }
}

router.get('/offers/get', async(req, res) => {
  const result = await getWeeklyOffers();

  res.send(result);
});

async function getWeeklyOffers(){
  const offers = await session
    .run(
      `MATCH (pr:Product)-[r:IN_PRODUCT_LIST]-(s:Store)-[i:HAS_STORE]-(u:User)
       WITH
       RETURN pr, s, u`
    )
    .then(function(result){

    })
    .catch(function(e){

    });
  return offers;
}

// Add product to fetured
router.post('/featured/add/:id', async(req, res) => {
  const id = req.params.id;
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        let offer = await addProductToFeatured(id, user);

        res.send(offer);
      });
    }catch(e){
      console.log(e);
    }
  }
});

async function addProductToFeatured(id, user){
  if(user){
    const steemId = user.steemId;
    const offer = await session
      .run(
        `MATCH (u:User), (s:Store), (p:Product)
         WHERE u.steemId = ${steemId} AND ID(p) = ${id}
         CREATE (s)-[r:IN_FEATURED { date: datetime() }]->(p)
         RETURN type(r)`
      )
      .then(function(result){
        session.close();
        return true;
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return offer;
  }
  else{
    return false;
  }
}

// get featured products
// if steemUsername is defined as parameter, get all featured products from that steem user (for store)
// else get all featured products from all users
router.get('/featured/get', async(req, res) => {
  const limit = req.query.limit;

  if(req.query.steemUsername !== undefined){
    try{
      const username = req.query.steemUsername;

      User.getSteemUserByUsername(username, async(err, user) => {
        const featureds = await getFeatured(limit, user);

        res.send(featureds);
      });
    }catch(e){
      console.log(e);
    }
  }
  else{
    try{
      const featureds = await getFeatured(limit);

      res.send(featureds);
    }catch(e){
      console.log(e);
    }
  }
});

async function getFeatured(limit = 5000, user = null){
  if(user){
    let steemId = user.steemId;
    const featured = await session
      .run(
        `MATCH (p:Product)-[r:IN_FEATURED]-(s:Store)-[t:HAS_STORE]-(u:User)
         WHERE u.steemId = ${steemId}
         RETURN p
         LIMIT ${limit}`
      )
      .then(function(result){
        let records = result.records;
        var total = [];

        for (i in records) {
          total.push({
            ...result.records[i]._fields[0].properties,
            id: result.records[i]._fields[0].identity.low,
            featured: true
          });
        }
        return total;
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return featured;
  }
  else{
    const featured = await session
      .run(
        `MATCH (p:Product)-[r:IN_FEATURED]-(s:Store)-[t:HAS_STORE]-(u:User)
         RETURN p
         LIMIT ${limit}`
      )
      .then(function(result){
        let records = result.records;
        var total = [];

        for (i in records) {
          total.push({
            ...result.records[i]._fields[0].properties,
            id: result.records[i]._fields[0].identity.low,
            featured: true
          });
        }
        return total;
      })
      .catch(function(e){
        console.log(e);
        return e;
      });
    return featured;
  }
}

// delete a featured product from the current steem user store
router.post('/featured/delete/:id', async(req, res) => {
  const id = req.params.id;
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        let product = await deleteProductFromFeatured(id, user);

        res.send(product);
      });
    }catch(e){
      console.log(e);
    }
  }
});

async function deleteProductFromFeatured(id, user){
  if(user){
    let steemId = user.steemId;
    const product = await session
      .run(
        `MATCH p =(pr:Product)-[r:IN_FEATURED]-(s:Store)-[t:HAS_STORE]-(u:User)
         WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
         DELETE r`
      )
      .then(function(result) {
        session.close();
        return true;
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return product;
  }
  else{
    return false;
  }
}

module.exports = router;