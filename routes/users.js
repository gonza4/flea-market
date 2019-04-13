var express = require("express");
var router = express.Router();
var session = require("../db/index");
var bcrypt = require("bcryptjs");
var passport = require("passport");
var steem = require("../steemconnect");
var crypto = require("crypto");

var User = require("../models/user");

router.get("/signin", function(req, res) {
  res.render("signin");
});

router.get("/login", function(req, res) {
  res.render("login");
});

router.post("/signin", function(req, res) {
  var name = req.body.name;
  var email = req.body.email;
  var username = req.body.username;
  var password = req.body.password;
  var password2 = req.body.password2;

  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
  var hash2 = bcrypt.hashSync(password2, salt);

  // Validations
  req.checkBody("name", "Name is required").notEmpty();
  req.checkBody("email", "Email is required").notEmpty();
  req.checkBody("email", "Email is not valid").isEmail();
  req.checkBody("username", "Username is required").notEmpty();
  req.checkBody("password", "Password is required").notEmpty();
  req
    .checkBody("password", "Password must have at least 8 caracteres")
    .isLength({ min: 8 });
  req.checkBody("password2", "Password do not match").equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    res.render("signin", {
      errors
    });
  } else {
    session
      // check if username and email already exist in database
      .run(
        "MATCH (u:User) WHERE u.username = $username OR u.email = $email RETURN u",
        {
          username,
          email
        }
      )
      .then(function(result) {
        var singleRecord = result.records[0];

        //if not exist, create new user
        if (singleRecord === undefined) {
          session
            .run(
              "CREATE (u:User {name: $name, email: $email, username: $username, password: $password, password2: $password2, date: datetime()}) RETURN u",
              {
                name,
                username,
                email,
                password: hash,
                password2: hash2
              }
            )
            .then(function(result) {
              session.close();
              var singleRecord = result.records[0];
              var node = singleRecord._fields[0].properties;

              req.session.id = req.cookies["connect.sid"];

              res.redirect("login");
            })
            .catch(function(err) {
              console.log(err);
            });
        } else {
          var node = singleRecord._fields[0].properties;

          if (username == node.username) {
            req.flash("error_msg", "Username is alredy use");
          } else {
            req.flash("error_msg", "Email is alredy use");
          }
          res.redirect("signin");
        }
      })
      .catch(function(err) {
        console.log(err);
      });
  }
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/users/login",
    failureFlash: true
  }),
  function(req, res) {
    res.redirect("/");
  }
);


router.get('/logout', function(req, res){
  try {
    if (req.session.steemconnect !== undefined) {
      req.session.destroy();
    }
    else {
      req.logout();
    }

    res.send('Logged out correctly')
  } catch(e) {
    console.log(e);
    res.send('Could not log out.')
  }
});

router.get("/loginUrl", function(req, res, next) {
  res.send(steem.getLoginURL());
});

router.get("/accountDetails", function(req, res, next) {
  if (req.session.steemconnect) {
    res.send(User.getSteemConnectProfile(req));
  }
  else if(req.user) {
    res.send(req.user)
  }
  else {
    res.send('Could not get account details')
  }
});

router.get("/auth/steem", function(req, res, next) {
  if (!req.query.access_token) {
    var uri = steem.getLoginURL();
    res.redirect(uri);
  } else {
    steem.setAccessToken(req.query.access_token);
    steem
      .me()
      .then(function(steemResponse) {
        req.session.steemconnect = steemResponse.account;
        req.session.access_token = req.query.access_token;

        var steemId = steemResponse.account.id;

        User.getUserBySteemId(steemId, function(err, user) {
          if (err) return err;
          if (user) {
            return user;
          } else {
            var description = JSON.parse(steemResponse.account.json_metadata)['profile']['about'] !== undefined ? 
                                         JSON.parse(steemResponse.account.json_metadata)['profile']['about'] : '';
            var username = steemResponse.account.name;
            var displayName = JSON.parse(steemResponse.account.json_metadata)['profile']['name'] !== undefined ? 
                                         JSON.parse(steemResponse.account.json_metadata)['profile']['name'] : null;
            var profileImage = JSON.parse(steemResponse.account.json_metadata)['profile']['profile_image'] !== undefined ? 
                                         JSON.parse(steemResponse.account.json_metadata)['profile']['name'] : null;
            var coverImage = JSON.parse(steemResponse.account.json_metadata)['profile']['cover_image'] !== undefined ? 
                                         JSON.parse(steemResponse.account.json_metadata)['profile']['name'] : null;
            session
              .run(
                `CREATE (u:User {steemId: $steemId, 
                 username: $username,
                 description: $description,
                 displayName: $displayName,
                 profileImage: $profileImage,
                 coverImage: $coverImage,
                 date: datetime() }) 
                 RETURN u`,
                {
                  steemId,
                  username,
                  description,
                  displayName,
                  profileImage,
                  coverImage
                }
              )
              .then(function(result) {
                session.close();

                session
                  .run(`MATCH (u:User)
                        WHERE u.steemId = ${steemId}
                        CREATE (s:Store { active: false })
                        CREATE (u)-[r:HAS_STORE]->(s)
                        RETURN type(r)`
                 );
              })
              .catch(function(err) {
                console.log(err);
              });
          }
        });

        var random = Math.random().toString();
        var hash = crypto
          .createHash("sha1")
          .update(random)
          .digest("hex");

        req.session.save(err => console.log(err));

        // res.redirect('http://localhost:8081/#/login?access=' + hash);
        res.redirect('/#/login?access=' + hash);
      })
      .catch(function(error) {
        console.log(error);
      });
  }
});

router.post("/profile/edit", async(req, res) => {
  const id = req.params.id;
  const result = User.getSteemConnectProfile(req);

  if(result === undefined){
    res.send(null);
  }
  else{
    try{
      User.getUserBySteemId(result.id, async(err, user) => {
        let profile = await editUserProfile(user, req);

        res.send(profile);
      });
    }catch(e){
      console.log(e);
      res.send(e)
    }
  }
});

async function editUserProfile(user, req){
  if(user){
    const steemId = user.steemId;
    const update = await session
      .run(
        `MATCH (u:User)
         WHERE u.steemId = ${steemId}
         RETURN u`
      )
      .then(function(result){
        session.close();
        var singleRecord = result.records[0];

        if(singleRecord != null){
          var properties = singleRecord._fields[0].properties;

          const description = req.body.description !== undefined ? req.body.description : properties.description;
          const displayName = req.body.displayName !== undefined ? req.body.displayName : properties.displayName;
          const profileImage = req.body.profileImage !== undefined ? req.body.profileImage : properties.profileImage;
          const coverImage = req.body.coverImage !== undefined ? req.body.coverImage : properties.coverImage;

          return session
            .run(
              `MATCH (u:User)
               WHERE u.steemId = ${steemId}
               SET u.description = '${description}',
                   u.displayName = '${displayName}',
                   u.profileImage = '${profileImage}',
                   u.coverImage = '${coverImage}'
               RETURN u`
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
    return update;
  }
}

module.exports = router;