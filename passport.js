var passport = require("passport");
var localStrategy = require("passport-local").Strategy;
var FacebookStrategy = require("passport-facebook").Strategy;
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
var configAuth = require("./auth");
var session = require("./db/index");
var User = require("./models/user");

module.exports = function(passport) {
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  passport.use(
    new localStrategy(function(username, password, done) {
      User.getUserByUsername(username, function(err, user) {
        if (err) throw err;
        if (!user) {
          return done(null, false, { message: "Username do not exists" });
        }

        if ("password" in user) {
          User.comparePassword(password, user.password, function(err, isMatch) {
            if (err) throw err;
            if (isMatch) {
              return done(null, user);
            } else {
              return done(null, false, { message: "Invalid Password" });
            }
          });
        } else {
          console.log("error");
        }
      });
    })
  );

  passport.use(
    new FacebookStrategy(
      {
        clientID: configAuth.facebookAuth.clientID,
        clientSecret: configAuth.facebookAuth.clientSecret,
        callbackURL: configAuth.facebookAuth.callbackURL,
        profileFields: ["emails", "name", "picture"]
      },
      function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
          User.getUserByFacebookId(profile.id, function(err, user) {
            if (err) return done(err);
            if (user) return done(null, user);
            else {
              session
                .run(
                  "CREATE (u:User {facebookId: $facebookId, facebookToken: $facebookToken, name: $name, email: $email, picture: $picture, guest: $guest}) RETURN u",
                  {
                    facebookId: profile.id,
                    guest: true,
                    facebookToken: accessToken,
                    name:
                      profile.name.givenName + " " + profile.name.familyName,
                    email: profile.emails[0].value,
                    picture: profile.photos[0].value
                  }
                )
                .then(function(result) {
                  session.close();
                })
                .catch(function(err) {
                  console.log(err);
                });
            }
          });
        });
      }
    )
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: configAuth.googleAuth.clientID,
        clientSecret: configAuth.googleAuth.clientSecret,
        callbackURL: configAuth.googleAuth.callbackURL,
        profileFields: ["emails", "name"]
      },
      function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
          User.getUserByGoogleId(profile.id, function(err, user) {
            if (err) return done(err);
            if (user) return done(null, user);
            else {
              session
                .run(
                  "CREATE (u:User {googleId: $googleId, googleToken: $googleToken, name: $name, email: $email, guest: $guest, picture: $picture}) RETURN u",
                  {
                    googleId: profile.id,
                    guest: true,
                    googleToken: accessToken,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    picture: profile.photos[0].value
                  }
                )
                .then(function(result) {
                  session.close();
                })
                .catch(function(err) {
                  console.log(err);
                });
            }
          });
        });
      }
    )
  );
};
