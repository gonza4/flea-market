var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var exphbs = require("express-handlebars");
var expressValidator = require("express-validator");
var flash = require("connect-flash");
var session = require("express-session");
var passport = require("passport");
var neoSession = require("./db/index");
var cors = require("cors");

require("./passport")(passport);

var routes = require("./routes/index");
var users = require("./routes/users");
var products = require("./routes/product");
var store = require("./routes/store");
var browser = require("./routes/browser");

var app = express();

//================================================//
//  Production only
//================================================//
app.use(cors());
// Sends static files  from the public path directory
app.use(express.static(path.join(__dirname, "/client/dist")));
//================================================//

// app.set('views', path.join(__dirname, 'views'));
// app.engine('handlebars', exphbs({defaultLayout: 'layout'}));
// app.set('view engine', 'handlebars');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secret",
    saveUninitialized: false,
    resave: true,
    cookie: {
      secure: false,
      maxAge: 600000
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Redirect the user to Facebook for authentication.  When complete,
// Facebook will redirect the user back to the application at
//     /users/auth/facebook/callback
app.get(
  "/users/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get(
  "/users/auth/facebook/callback",
  passport.authenticate("facebook", {
    successRedirect: "/#/login",
    failureRedirect: "/#/signin"
  })
);

app.get(
  "/users/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/users/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/#/",
    failureRedirect: "/#/signin"
  })
);

// Express Validator
app.use(
  expressValidator({
    errorFormatter: function(param, msg, value) {
      var namespace = param.split("."),
        root = namespace.shift(),
        formParam = root;

      while (namespace.lenght) {
        formParam += "[" + namespace.shift() + "]";
      }
      return {
        param: formParam,
        msg: msg,
        value: value
      };
    }
  })
);

app.use(flash());

app.use(function(req, res, next) {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.user || null;
  next();
});

app.use("/app", routes);

app.use("/users", users);
app.use("/app/product", products);
app.use("/store", store);
app.use("/browser", browser);

app.use("/products", products);

app.set("port", process.env.PORT || 8080);

app.listen(app.get("port"), function() {
  console.log("Server started on port " + app.get("port"));
});
