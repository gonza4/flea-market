var express = require("express");
var router = express.Router();
var session = require("../db/index");

var Product = require("../models/product");
var User = require("../models/user");

router.post('/saveSearch', async (req, res) => {
  session
    .run("CREATE (e:Statistics { productNameSearch: $searchString}) RETURN e", {searchString: req.body.searchString})
    .then(function(result){
      console.log(`Search: ${req.body.searchString} has been saved`)
      console.log(result)
    })
    .catch(function(e){console.log(e)});

  res.send('Not found')
})

router.post('/saveVisit', async (req, res) => {
  session
    .run("MATCH (c:Counter) WITH c, c.visits + 1 AS total SET c.visits = total RETURN c")
    .then(function(result){

      console.log(`A new visitor has checked in`)
      console.log(result)
    })
    .catch(function(e){console.log(e)});

  res.send('Not found')
})

// get a product by id
router.get("/byId", async (req, res) => {
  const id = req.query.id;

  const result = await Product.getProductById(id);
  // console.log(result);
  res.send(result);
});

// Autocomplete product names
router.get("/autocomplete", async (req, res) => {
  let result = await getProductNames({ searchString: req.query.s, category: req.query.c })

  res.send(result)
})

async function getProductNames({ searchString, category }) {
  let query = `MATCH (p:Product) WHERE toLower(p.name) CONTAINS '${searchString}'`

  if (category) {
    query += ` AND p.category = '${category}'`
  }

  query += ' RETURN p.name'

  const results = await session
    .run(query)
    .then(result => {
      let list = []
      result.records.map((record, i) => {
        list.push(result.records[i]._fields[0])
      });

      return list
    })
    .catch(err => {
      console.log(err)
      return err;
    })

  return results;
}

// Create a new product
router.post("/add", async (req, res) => {
  let result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    User.getUserBySteemId(result.id, async (err, user) => {
      var product = await createProduct(user, req);
      res.send(product);
    });
  }
});

async function createProduct(user, req) {
  // create a product and associate it with the steam user
  if (user) {
    let name = req.body.name !== undefined ? req.body.name : "";
    let description =
      req.body.description !== undefined ? req.body.description : "";
    let author = req.body.author !== undefined ? req.body.author : "";
    let permlink = req.body.permlink !== undefined ? req.body.permlink : "";
    let type = req.body.type !== undefined ? req.body.type : "";
    let pictures = req.body.pictures !== undefined ? req.body.pictures : "";
    let stock = req.body.stock !== undefined ? req.body.stock : "";
    let priceValue =
      req.body.priceValue !== undefined ? req.body.priceValue : "";
    let currency = req.body.currency !== undefined ? req.body.currency : "";
    let category = req.body.category !== undefined ? req.body.category : "";
    let listing = req.body.listing;
    const steemId = user.steemId;

    const product = await session
      .run(
        `CREATE (p:Product {
          author: $author,
          category: $category,
          description: $description,
          name: $name,
          permlink: $permlink,
          pictures: $pictures,
          priceValue: $priceValue,
          currency: $currency,
          stock: $stock,
          date: datetime(),
          likesQuantity: 0,
          type: $type
        }) RETURN p`,
        {
          author,
          category,
          description,
          name,
          permlink,
          pictures,
          priceValue,
          currency,
          stock,
          type
        }
      )
      .then(function(result) {
        let singleRecord = result.records[0];
        let node = singleRecord._fields[0].properties;
        let productId = singleRecord._fields[0].identity;

        session.run(
          `MATCH (u:User),(p:Product),(s:Store)
           WHERE u.steemId = $steemId AND ID(p) = $productId
           CREATE (s)-[r:HAS_PRODUCT { date: datetime() }]->(p)
           RETURN type(r)`,
          {
            steemId,
            productId
          }
        );

        if (listing !== undefined) {
          session.run(
            `MATCH (u:User),(p:Product),(s:Store)
               WHERE u.steemId = ${steemId} AND ID(p) = ${productId}
               CREATE (s)-[r:IN_PRODUCT_LIST { name: '${listing}', date: datetime() } ]->(p)
               RETURN type(r)`
          );
        }

        session.close();
        return node;
      })
      .catch(function(err) {
        console.log(err);
        return err;
      });
    return product;
  } else {
    return false;
  }
}

router.post("/edit/:id", async (req, res) => {
  const result = await User.getSteemConnectProfile(req);
  const productId = req.params.id;

  if (result === undefined) {
    res.send(null);
  } else {
    User.getUserBySteemId(result.id, async (err, user) => {
      var product = await editProduct(productId, user, req);
      res.send(product);
    });
  }
});

async function editProduct(productId, user, req) {
  if (user) {
    const steemId = user.steemId;
    const product = await session
      .run(`MATCH (p:Product) WHERE ID(p)= ${productId} RETURN p`)
      .then(function(result) {
        let singleRecord = result.records[0];
        if (singleRecord != null) {
          let properties = singleRecord._fields[0].properties;

          let name =
            req.body.name !== undefined ? req.body.name : properties.name;
          let description =
            req.body.description !== undefined
              ? req.body.description
              : properties.description;
          let author =
            req.body.author !== undefined ? req.body.author : properties.author;
          let permlink =
            req.body.permlink !== undefined
              ? req.body.permlink
              : properties.permlink;
          let type =
            req.body.type !== undefined ? req.body.type : properties.type;
          let pictures =
            req.body.pictures !== undefined
              ? req.body.pictures
              : properties.pictures;
          let stock =
            req.body.stock !== undefined ? req.body.stock : properties.stock;
          let priceValue =
            req.body.price.value !== undefined
              ? req.body.price.value
              : properties.priceValue;
          let currency =
            req.body.price.currency !== undefined
              ? req.body.price.currency
              : properties.currency;
          let category =
            req.body.category !== undefined
              ? req.body.category
              : properties.category;
          let listing = req.body.listing;

          return session
            .run(
              `MATCH (p:Product)
               WHERE ID(p) = ${productId}
               SET p.name = $name,
                   p.description = $description,
                   p.author = $author,
                   p.permlink = $permlink,
                   p.type = $type,
                   p.pictures = $pictures,
                   p.stock = $stock,
                   p.priceValue = $priceValue,
                   p.currency = $currency,
                   p.category = $category
               RETURN p`,
              {
                name,
                description,
                author,
                permlink,
                type,
                pictures,
                stock,
                priceValue,
                currency,
                category
              }
            )
            .then(function(result) {
              session.close();
              var singleRecord = result.records[0];
              var node = singleRecord._fields[0].properties;

              if (listing !== undefined) {
                session
                  .run(
                    `MATCH (u:User)-[t:HAS_STORE]-(s:Store)-[r:IN_PRODUCT_LIST]-(p:Product)
                     WHERE u.steemId = ${steemId} AND ID(p) = ${productId}
                     SET r.name = '${listing}'
                     RETURN type(r)`
                  )
                  .catch(function(e) {
                    console.log(e);
                  });
              }

              return node;
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        }
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return product;
  }
}

// Get all products from all users
router.get("/all", async (req, res) => {
  const result = await User.getSteemConnectProfile(req);
  const page = req.query.page;
  const limit = req.query.limit;

  var wishlist = [];

  if (result !== undefined) {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var wishlist = await getWishlist(user);
        var shopcart = await getShopCart(user);
        var liked = await getLikedProducts(user);

        var product = await getAllProducts(
          wishlist,
          shopcart,
          liked,
          page,
          limit
        );
        res.send(product);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  } else {
    try {
      var product = await getAllProducts(null, null, null, page, limit);
      res.send(product);
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getAllProducts(wishlist, shopcart, liked, page = 1, limit = 12) {
  page = parseInt(page);
  limit = parseInt(limit);
  page = page < 1 ? 1 : page;
  page = page != 1 ? limit : page - 1;
  const count = await session
    .run("MATCH (p:Product) RETURN COUNT(p)")
    .then(function(result) {
      session.close();
      return result.records[0];
    });
  var finalCount = 0;

  if (count.length > 0) {
    finalCount = count._fields[0].low;
  }

  const product = await session
    .run(
      "MATCH (p:Product) RETURN DISTINCT p ORDER BY ID(p) DESC SKIP $page LIMIT $limit",
      {
        page,
        limit
      }
    )
    .then(function(result) {
      session.close();
      let total = [];
      let wishlistIds = wishlist ? wishlist.map(p => p.id) : null;
      let shopcartIds = shopcart ? shopcart.map(p => p.id) : null;
      let likedIds = liked ? liked.map(p => p.id) : null;

      for (i in result.records) {
        let id = result.records[i]._fields[0].identity.low;
        total.push({
          ...result.records[i]._fields[0].properties,
          id,
          wishlist: wishlistIds ? wishlistIds.includes(id) : false,
          shopcart: shopcartIds ? shopcartIds.includes(id) : false,
          liked: likedIds ? likedIds.includes(id) : false,
          count: finalCount
        });
      }
      return total;
    })
    .catch(function(e) {
      console.log(e);
      return e;
    });
  return product;
}

// get all products
// if steemUsername is defined as parameter, get all products from that steem user
// else get all products from the current user
router.get("/all/user", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;

  if (req.query.steemUsername !== undefined) {
    try {
      const username = req.query.steemUsername;

      User.getSteemUserByUsername(username, async (err, user) => {
        var product = await getAllProductsFromUser(user, page, limit);

        res.send(product);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  } else {
    try {
      const result = await User.getSteemConnectProfile(req);

      if (result === undefined) {
        res.send(null);
      } else {
        User.getUserBySteemId(result.id, async (err, user) => {
          var product = await getAllProductsFromUser(user, page, limit);
          res.send(product);
        });
      }
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getAllProductsFromUser(user, page = 1, limit = 20) {
  if (user) {
    page = parseInt(page);
    limit = parseInt(limit);
    page = page < 1 ? 1 : page;
    page = page != 1 ? limit : page - 1;
    const count = await session.run(
      "MATCH (u:User { steemId: $steemId })--(:Store)--(p:Product) RETURN COUNT(DISTINCT p)",
      {steemId: user.steemId})
      .then(function(result){
        session.close();
        return result.records[0];
      })
      .catch(err => {
        console.log(err)
        return err;
      });
    var finalCount = 0;

    if(count.length > 0){
      console.log(count)
      finalCount = count._fields[0].low;
    }

    const product = await session
      .run(
        "MATCH (u:User { steemId: $steemId })--(:Store)--(p:Product) RETURN DISTINCT p ORDER BY ID(p) DESC SKIP $page LIMIT $limit",
        {
          steemId: user.steemId,
          page,
          limit
        }
      )
      .then(function(result) {
        session.close();
        var total = [];
        for (i in result.records) {
          let id = result.records[i]._fields[0].identity.low;
          total.push({
            ...result.records[i]._fields[0].properties,
            id,
            count: finalCount
          });
        }
        return total;
      })
      .catch(function(err) {
        return err;
      });

    return product;
  } else {
    return null;
  }
}

router.post("/delete/:id", async (req, res) => {
  const id = req.params.id;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    User.getUserBySteemId(result.id, async (err, user) => {
      var product = await deleteProduct(id, user);
      res.send(product);
    });
  }
});

async function deleteProduct(id, user) {
  if (user) {
    const result = await session
      .run(`MATCH (p:Product) WHERE ID(p)= ${id} DETACH DELETE p`)
      .then(function(result) {
        session.close();
        return true;
      })
      .catch(function(e) {
        return e;
      });

    return result;
  } else {
    return false;
  }
}

router.post("/wishlist/:id", async (req, res) => {
  const id = req.params.id;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var product = await addProductToWishlist(id, user);
        res.send(product);
      });
    } catch (e) {
      console.log(e);
    }
  }
});

async function addProductToWishlist(id, user) {
  if (user) {
    let steemId = user.steemId;
    const result = await session
      .run(
        `MATCH p =(pr:Product)-[r:WISHLIST]-(u:User)
         WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
         RETURN p`
      )
      .then(function(result) {
        var singleRecord = result.records[0];
        if (singleRecord === undefined) {
          return session
            .run(
              `MATCH (u:User),(p:Product) WHERE u.steemId = ${steemId} AND ID(p) = ${id} CREATE (u)-[r:WISHLIST { date: datetime() }]->(p) RETURN type(r)`
            )
            .then(function(result) {
              session.close();
              return true;
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        } else {
          return session
            .run(
              `MATCH p =(pr:Product)-[r:WISHLIST]-(u:User)
               WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
               DELETE r`
            )
            .then(function(result) {
              session.close();
              return false;
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        }
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return result;
  } else {
    return false;
  }
}

router.get("/wishlist", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var shopcart = await getShopCart(user, null, null);
        var liked = await getLikedProducts(user);

        var wishlist = await getWishlist(user, shopcart, liked, page, limit);
        res.send(wishlist);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getWishlist(user, shopcart, liked, page = 1, limit = 12) {
  if (user) {
    page = parseInt(page);
    limit = parseInt(limit);
    page = page < 1 ? 1 : page;
    page = page != 1 ? limit : page - 1;

    const count = await session
      .run(
        "MATCH (u:User { steemId: $steemId })-[:WISHLIST]-(p:Product) RETURN COUNT(p)",
        {
          steemId: user.steemId
        }
      )
      .then(function(result) {
        session.close();
        return result.records[0];
      })
      .catch(function(e) {
        return e;
      });
    var finalCount = 0;

    if (count.length > 0) {
      finalCount = count._fields[0].low;
    }

    const wishlist = await session
      .run(
        "MATCH (u:User { steemId: $steemId })-[:WISHLIST]-(p:Product) RETURN DISTINCT p ORDER BY ID(p) DESC SKIP $page LIMIT $limit",
        {
          steemId: user.steemId,
          page,
          limit
        }
      )
      .then(function(result) {
        session.close();
        let total = [];
        let shopcartIds = shopcart ? shopcart.map(p => p.id) : null;
        let likedIds = liked ? liked.map(p => p.id) : null;

        for (i in result.records) {
          let id = result.records[i]._fields[0].identity.low;
          total.push({
            ...result.records[i]._fields[0].properties,
            id,
            shopcart: shopcartIds ? shopcartIds.includes(id) : false,
            liked: likedIds ? likedIds.includes(id) : false,
            wishlist: true,
            count: finalCount
          });
        }
        return total;
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return wishlist;
  } else {
    return null;
  }
}

// create categories and subcategories
router.get("/categories", async(req, res) => {
  let categories = [
    ['Accesories for vehicles'],
    ['Beauty & Personal Care'],
    ['Books'],
    ['Crafts & Sewings'],
    ['Crafts Supply'],
    ['Digital Art'],
    ['Fashion'],
    ['Home'],
    ['Music'],
    ['Sports & Outdoor'],
    ['Services'],
    ['Technology'],
    ['Toys & Babies'],
    ['Tools & Industry'],
    ['Videogames']
  ]
  // [
  //   ['Books',
  //    [
  //     ['Fiction books',
  //       [
  //        ['Novels',
  //           ['New',
  //            'Used'
  //           ],
  //        ],
  //        ['Stories',
  //           ['Children',
  //            'Contemporary Literature',
  //            'Drama',
  //            'Action and Adventure',
  //            'Science Fiction',
  //            'Police and Suspension',
  //            'Fantasy',
  //            'Terror',
  //            'Humor'
  //            ],
  //         ],
  //       ],
  //     ],
  //     ['Comics and Comics',
  //       [
  //        ['Condition',
  //         [
  //          'New',
  //          'Used'
  //         ],
  //        ],
  //       ],
  //     ],
  //     ['Social Sciences Books',
  //       [
  //        ['History',
  //         [
  //          'Universal',
  //          'Europe',
  //          'Latin America',
  //          'North America',
  //          'Asia',
  //          'Other'
  //         ],
  //        ],
  //        ['Politics',
  //         [
  //           'Theories and Political Philosophies',
  //           'International Policy',
  //           'Other'
  //          ],
  //         ],
  //       ],
  //     ],
  //     ['Journals',
  //       [
  //        ['General interest'
  //         ],
  //        ['Music'
  //         ],
  //        ['Fashion and Crafts'
  //         ],
  //       ],
  //     ],
  //     ['Books of Cs Humanísticas',
  //       [
  //        ['Psychology',
  //         [
  //          'New',
  //          'Used'
  //         ],
  //        ],
  //        ['Philosophy',
  //         [
  //           'New',
  //           'Used'
  //          ],
  //         ],
  //       ],
  //     ],
  //     ['Self help',
  //       [
  //        ['Personal growth',
  //           [
  //            'New',
  //            'Used'
  //           ],
  //        ],
  //        ['Couple and Sexuality',
  //           [
  //             'New',
  //             'Used'
  //            ],
  //         ],
  //        ['Body Aesthetics and Diets',
  //           [
  //             'New',
  //             'Used'
  //            ],
  //         ],
  //        ['Alternative therapies',
  //           [
  //             'New',
  //             'Used'
  //            ],
  //         ],
  //       ],
  //     ],
  //     ['Medical / Natural Cs Books',
  //       [
  //        ['Medicine',
  //           [
  //            'Anatomy',
  //            'Surgery',
  //            'Nursing',
  //            'Pathologies',
  //            'Internal Medicine',
  //            'Gynecology and Obstetrics',
  //            'Pediatrics',
  //            'Psychiatry',
  //            'Neurology'
  //           ],
  //        ],
  //        ['Nutrition',
  //         [
  //          'New',
  //          'Used'
  //         ],
  //        ],
  //       ],
  //     ],
  //     ['Technical Books',
  //       [
  //         ['Cars',
  //           [
  //             "Medicine",
  //             [
  //               "Anatomy",
  //               "Surgery",
  //               "Nursing",
  //               "Pathologies",
  //               "Internal Medicine",
  //               "Gynecology and Obstetrics",
  //               "Pediatrics",
  //               "Psychiatry",
  //               "Neurology"
  //             ]
  //           ],
  //         ],
  //         ['Building',
  //             [
  //              'New',
  //              'Used'
  //             ],
  //         ],
  //         ['Sewing and Weaving',
  //             [
  //              'New',
  //              'Used'
  //             ],
  //         ],
  //         ['Electricity',
  //           [
  //            'New',
  //            'Used'
  //           ],
  //         ],
  //       ],
  //     ],
  //     ['Religion Books',
  //       [
  //        ['Christianity and Catholicism',
  //           [
  //            'New',
  //            'Used'
  //           ],
  //        ],
  //        ['Spirituality',
  //           [
  //            'New',
  //            'Used'
  //           ],
  //        ],
  //       ],
  //     ],
  //    ],
  //   ],
  // ];

  const pass = req.query.pass;

  // if(pass == 'd_stors_001'){
  const result = await createCategory(categories);
  // }
  res.send(result)
});

async function createCategory(categories) {
  if (Array.isArray(categories)) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i] !== undefined) {
        let categoryName = categories[i][0];
        let arrayAux = categories[i];

        return session
          .run(`MATCH (c:Category { name: $name }) RETURN c`, {
            name: categoryName
          })
          .then(function(result) {
            session.close();
            let singleRecord = result.records[0];

            if (singleRecord === undefined) {
              session
                .run(
                  `CREATE (c:Category {name: $name, date: datetime()}) RETURN c`,
                  {
                    name: categoryName
                  }
                )
                .then(function(result) {
                  session.close();
                  const categoryId = result.records[0]._fields[0].identity.low;

                  if (arrayAux[1] !== undefined) {
                    const subcategory = createSubCategory(
                      arrayAux[1],
                      categoryId
                    );
                  }
                  return result
                })
                .catch(function(e) {
                  return e
                  console.log(e);
                });
            } else {
            }
          })
          .catch(function(e) {
            console.log(e);
          });
      }
    }
  } else {
    console.log("incorrect format, must be an array");
  }
  console.log("Finish");
}

async function createSubCategory(subcategories, categoryId, node = "Category") {
  if (Array.isArray(subcategories)) {
    for (var i = 0; i < subcategories.length; i++) {
      let arrayAux = subcategories[i];

      let name = subcategories[i][0];

      var level = 1;
      var sublevel = 1;

      if (node !== "Category" && !Array.isArray(subcategories[i])) {
        name = subcategories[i];
      }

      if (node !== "Category") {
        sublevel = await getSubcategoryLevel(categoryId, name, node);

        if (sublevel) {
          level = sublevel + level;
        }
      }

      await session
        .run(
          `MATCH p=(s:SubCategory)-[r:SUBCATEGORY]-(c:${node})
           WHERE ID(c) = ${categoryId} AND s.name = '${name}'
           RETURN s`
        )
        .then(function(result) {
          session.close();
          let singleRecord = result.records[0];

          if (singleRecord === undefined) {
            session
              .run(
                `MATCH (c:${node})
                 WHERE ID(c) = ${categoryId}
                 CREATE (s:SubCategory { name: '${name}', level: ${level} })
                 CREATE (s)-[r:SUBCATEGORY { level: ${level}, date: datetime() }]->(c)
                 RETURN s`
              )
              .then(function(result) {
                session.close();
                const subCategoryId = result.records[0]._fields[0].identity.low;

                createSubCategory(arrayAux[1], subCategoryId, "SubCategory");
              })
              .catch(function(e) {
                console.log(e);
              });
          } else {
          }
        })
        .catch(function(e) {
          console.log(e);
        });
    }
  } else {
    // console.log("incorrect format, must be an array");
  }
}

async function getSubcategoryLevel(categoryId, name, node) {
  try {
    const result = await session
      .run(
        `MATCH (s:SubCategory)
            WHERE ID(s) = ${categoryId}
            RETURN s`
      )
      .then(function(result) {
        session.close();
        var level =
          result.records[0] !== undefined
            ? result.records[0]._fields[0].properties.level.low
            : null;
        return level;
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return result;
  } catch (e) {
    console.log(e);
  }
}

// Get all categories names
router.get('/categories/get', async(req, res) => {
  // if(pass === 'd_stors_001'){
    const result = await getCategories();

    res.send(result);
  // }
});

async function getCategories(){
  const categories = await session
    .run(
      `MATCH (c:Category) RETURN DISTINCT c ORDER BY c.name`
    )
    .then(function(result){
      session.close();
      let records = result.records;
      let total = [];

      for(i in result.records){
        total.push(result.records[i]._fields[0].properties.name
        );
      }

      return total;
    })
    .catch(function(e){
      console.log(e);
      return e;
    });
  return categories;
}

// Get the subcategories from a category passed by parameters
router.get('/subcategories/get', async(req, res) => {
  const categoryName = req.query.name;
  const pass = req.query.pass;
  // if(pass === 'd_stors_001'){
    const result = await getSubCategories(categoryName);

  res.send(result);
  // }
});

async function getSubCategories(name){
  const categories = await session
    .run(
      `MATCH p=(c:Category { name: $name })-[r:SUBCATEGORY*1..]-(s:SubCategory)
       RETURN DISTINCT p`,
       {
        name
      }
    )
    .then(function(result) {
      session.close();
      var total = [];
      const categoryName = name;
      var subCategoryNameLevel1 = '';
      var subCategoryNameLevel2 = '';

      for(i in result.records){
        var subCategoryNameLevel1 = result.records[i]._fields[0].segments[0].end.properties.name;
        var subCategoryNameLevel2 = result.records[i]._fields[0].segments[1] !== undefined ?
                                    result.records[i]._fields[0].segments[1].end.properties.name : null;
        var subCategoryNameLevel3 = result.records[i]._fields[0].segments[2] !== undefined ?
                                    result.records[i]._fields[0].segments[2].end.properties.name : null;

        if(subCategoryNameLevel2 != null && subCategoryNameLevel3 != null){
          total.push({
            categoryName,
            subCategoryNameLevel1,
            subCategoryNameLevel2,
            subCategoryNameLevel3
          });
        }
      }
      console.log(total);
      return total;
    })
    .catch(function(e) {
      console.log(e);
      return e;
    });
  return categories;
}

router.post("/shopcart/:id", async (req, res) => {
  const id = req.params.id;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var product = await addProductToShopCart(id, user);
        res.send(product);
      });
    } catch (e) {
      console.log(e);
    }
  }
});

async function addProductToShopCart(id, user) {
  if (user) {
    let steemId = user.steemId;
    const result = await session
      .run(
        `MATCH p =(pr:Product)-[r:IN_SHOPCART]-(u:User)
         WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
         RETURN p`
      )
      .then(function(result) {
        var singleRecord = result.records[0];
        if (singleRecord === undefined) {
          return session
            .run(
              `MATCH (u:User),(p:Product)
               WHERE u.steemId = ${steemId} AND ID(p) = ${id}
               CREATE (u)-[r:IN_SHOPCART { date: datetime() }]->(p)
               RETURN type(r)`
            )
            .then(function(result) {
              session.close();
              return true;
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        } else {
          return session
            .run(
              `MATCH p =(pr:Product)-[r:IN_SHOPCART]-(u:User)
               WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
               DELETE r`
            )
            .then(function(result) {
              session.close();
              return false;
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        }
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return result;
  } else {
    return false;
  }
}

router.get("/shopcart", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var wishlist = await getWishlist(user, null, null);
        var liked = await getLikedProducts(user);

        var product = await getShopCart(user, wishlist, liked, page, limit);
        res.send(product);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getShopCart(user, wishlist, liked, page = 1, limit = 12) {
  if (user) {
    page = parseInt(page);
    limit = parseInt(limit);
    page = page < 1 ? 1 : page;
    page = page != 1 ? limit : page - 1;

    const count = await session
      .run(
        "MATCH (u:User { steemId: $steemId })-[:IN_SHOPCART]-(p:Product) RETURN COUNT(p)",
        {
          steemId: user.steemId
        }
      )
      .then(function(result) {
        session.close();
        return result.records[0];
      })
      .catch(function(e) {
        return e;
      });
    var finalCount = 0;

    if (count.length > 0) {
      finalCount = count._fields[0].low;
    }

    const shopcart = await session
      .run(
        "MATCH (u:User { steemId: $steemId })-[:IN_SHOPCART]-(p:Product) RETURN DISTINCT p ORDER BY ID(p) DESC SKIP $page LIMIT $limit",
        {
          steemId: user.steemId,
          page,
          limit
        }
      )
      .then(function(result) {
        session.close();
        let total = [];
        let wishlistIds = wishlist ? wishlist.map(p => p.id) : null;
        let likedIds = liked ? liked.map(p => p.id) : null;

        for (i in result.records) {
          let id = result.records[i]._fields[0].identity.low;
          total.push({
            ...result.records[i]._fields[0].properties,
            id,
            wishlist: wishlistIds ? wishlistIds.includes(id) : false,
            liked: likedIds ? likedIds.includes(id) : false,
            shopcart: true,
            count: finalCount
          });
        }
        return total;
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return shopcart;
  } else {
    return null;
  }
}

router.post("/shopcart/delete/:id", async (req, res) => {
  const id = req.params.id;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    User.getUserBySteemId(result.id, async (err, user) => {
      var product = await deleteProductFromShopCart(id, user);
      res.send(product);
    });
  }
});

async function deleteProductFromShopCart(id, user) {
  if (user) {
    let steemId = user.steemId;
    const shopcart = session.run(
      `MATCH (p:Product) WHERE ID(p) = ${id} SET p.shopcart = false`
    );
    const result = await session
      .run(
        `MATCH p =(pr:Product)-[r:IN_SHOPCART]-(u:User)
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
    return result;
  } else {
    return false;
  }
}

// add product to likes
router.post("/like/:id", async (req, res) => {
  const id = req.params.id;
  const result = User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var product = await addProductToLikes(id, user);
        res.send(product);
      });
    } catch (err) {
      console.log(err);
    }
  }
});

async function addProductToLikes(id, user) {
  if (user) {
    let steemId = user.steemId;
    const result = await session
      .run(
        `MATCH p =(pr:Product)-[r:IN_LIKES]-(u:User)
         WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
         RETURN p`
      )
      .then(function(result) {
        var singleRecord = result.records[0];
        if (singleRecord === undefined) {
          const quantity = session.run(
            `MATCH (p:Product) WHERE ID(p) = ${id} SET p.like = true, p.likesQuantity = (p.likesQuantity + 1)`
          );
          return session
            .run(
              `MATCH (u:User),(p:Product)
               WHERE u.steemId = ${steemId} AND ID(p) = ${id}
               CREATE (u)-[r:IN_LIKES { date: datetime() }]->(p)
               RETURN r`
            )
            .then(function(result) {
              session.close();
              return result.records[0];
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        } else {
          const quantity = session.run(
            `MATCH (p:Product) WHERE ID(p) = ${id} AND p.likesQuantity > 0 SET p.like = false, p.likesQuantity = (p.likesQuantity - 1)`
          );
          return session
            .run(
              `MATCH p =(pr:Product)-[r:IN_LIKES]-(u:User)
               WHERE u.steemId = ${steemId} AND ID(pr) = ${id}
               DELETE r`
            )
            .then(function(result) {
              session.close();
              return false;
            })
            .catch(function(e) {
              console.log(e);
              return e;
            });
        }
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return result;
  } else {
    return false;
  }
}

router.get("/like/get", async (req, res) => {
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    res.send(null);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        var product = await getLikedProducts(user);
        res.send(product);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getLikedProducts(user) {
  if (user) {
    const liked = await session
      .run(
        "MATCH (u:User { steemId: $steemId })-[:IN_LIKES]-(p:Product) RETURN DISTINCT p",
        {
          steemId: user.steemId
        }
      )
      .then(function(result) {
        session.close();
        var total = [];
        for (i in result.records) {
          total.push({
            ...result.records[i]._fields[0].properties,
            id: result.records[i]._fields[0].identity.low,
            liked: true
          });
        }
        return total;
      })
      .catch(function(e) {
        console.log(e);
        return e;
      });
    return liked;
  } else {
    return null;
  }
}

// get hots products
// this are the products with more likes from all user
router.get("/hot/get", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    const hot = await getHotProducts(null, null, null, page, limit);
    res.send(hot);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        const wishlist = await getWishlist(user, null, null, 0, 10000);
        const shopcart = await getShopCart(user, null, null, 0, 10000);
        const liked = await getLikedProducts(user);

        const hot = await getHotProducts(
          wishlist,
          shopcart,
          liked,
          page,
          limit
        );
        res.send(hot);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getHotProducts(wishlist, shopcart, liked, page = 1, limit = 12) {
  page = parseInt(page);
  limit = parseInt(limit);
  page = page < 1 ? 1 : page;
  page = page != 1 ? limit : page - 1;

  const count = await session
    .run("MATCH (p:Product) WHERE EXISTS (p.likesQuantity) RETURN COUNT(p)")
    .then(function(result) {
      session.close();
      return result.records[0];
    })
    .catch(function(e) {
      return e;
    });
  var finalCount = 0;

  if (count.length > 0) {
    finalCount = count._fields[0].low;
  }

  const hot = await session
    .run(
      `MATCH (p:Product)
       WHERE EXISTS (p.likesQuantity)
       RETURN DISTINCT p
       ORDER BY p.likesQuantity DESC
       SKIP $page
       LIMIT $limit`,
      {
        page,
        limit
      }
    )
    .then(function(result) {
      session.close();
      let total = [];
      let records = result.records;

      let wishlistIds = wishlist ? wishlist.map(p => p.id) : null;
      let shopcartIds = shopcart ? shopcart.map(p => p.id) : null;
      let likedIds = liked ? liked.map(p => p.id) : null;

      for (i in records) {
        let id = result.records[i]._fields[0].identity.low;
        total.push({
          ...result.records[i]._fields[0].properties,
          id,
          wishlist: wishlistIds ? wishlistIds.includes(id) : false,
          shopcart: shopcartIds ? shopcartIds.includes(id) : false,
          liked: likedIds ? likedIds.includes(id) : false,
          count: finalCount
        });
      }
      return total;
    })
    .catch(function(e) {
      console.log(e);
      return e;
    });
  return hot;
}

// get new products order by creation date
router.get("/news/get", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const result = await User.getSteemConnectProfile(req);

  if (result === undefined) {
    const news = await getNewsProducts(null, null, null, page, limit);
    res.send(news);
  } else {
    try {
      User.getUserBySteemId(result.id, async (err, user) => {
        const wishlist = await getWishlist(user, null, null, 0, 10000);
        const shopcart = await getShopCart(user, null, null, 0, 10000);
        const liked = await getLikedProducts(user);

        const news = await getNewsProducts(
          wishlist,
          shopcart,
          liked,
          page,
          limit
        );
        res.send(news);
      });
    } catch (e) {
      console.log(e);
      res.send(e);
    }
  }
});

async function getNewsProducts(
  wishlist,
  shopcart,
  liked,
  page = 1,
  limit = 12
) {
  page = parseInt(page);
  limit = parseInt(limit);
  page = page < 1 ? 1 : page;
  page = page != 1 ? limit : page - 1;

  const count = await session
    .run("MATCH (p:Product) WHERE EXISTS (p.date) RETURN COUNT(p)")
    .then(function(result) {
      session.close();
      return result.records[0];
    })
    .catch(function(e) {
      return e;
    });
  var finalCount = 0;

  if (count.length > 0) {
    finalCount = count._fields[0].low;
  }

  const news = await session
    .run(
      `MATCH (p:Product)
       WHERE EXISTS (p.date)
       RETURN p
       ORDER BY p.date DESC
       SKIP $page
       LIMIT $limit`,
      {
        page,
        limit
      }
    )
    .then(function(result) {
      let records = result.records;
      var total = [];
      let wishlistIds = wishlist ? wishlist.map(p => p.id) : null;
      let shopcartIds = shopcart ? shopcart.map(p => p.id) : null;
      let likedIds = liked ? liked.map(p => p.id) : null;

      for (i in records) {
        let id = result.records[i]._fields[0].identity.low;
        total.push({
          ...result.records[i]._fields[0].properties,
          id,
          wishlist: wishlistIds ? wishlistIds.includes(id) : false,
          shopcart: shopcartIds ? shopcartIds.includes(id) : false,
          liked: likedIds ? likedIds.includes(id) : false,
          count: finalCount
        });
      }

      return total;
    })
    .catch(function(e) {
      console.log(e);
      return e;
    });
  return news;
}

module.exports = router;
