require("babel/register")

const app = require("koa")()
const koaBody = require("koa-better-body")
const hbs = require("koa-hbs")
const logger = require("koa-logger")
const koaMount = require("koa-mount")
const passport = require("koa-passport")
const KoaRouter = require("koa-router")
const session = require("koa-session")
const koaStatic = require("koa-static")
const path = require("path")
const bcrypt = require("bcryptjs")
const bodyParser = require('koa-bodyparser')

app.use(bodyParser())

// const r = require("rethinkdbdash")()
const r = require("rethinkdb")


let router = new KoaRouter()

app.use(koaBody({
  multipart: true,
  formLimit: 100000,
  extendTypes: {
  json: [ "application/x-javascript" ],
  multipart: [ "multipart/mixed" ]
  }
}))

app.use(logger())

app.keys = [ "1234567890" ]
app.use(session(app))

app.use(hbs.middleware({
  viewPath: path.join(__dirname, "/views")
}))

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  r.db("quoth").table("users").get(id).run(function (user) {
    done(null, user)
  })
})

let LocalStrategy = require('passport-local').Strategy

passport.use(new LocalStrategy(function (username, password, done) {
  console.log(username, password)
  r.db("quoth").table("users").filter({ email: username}).run(conn, function (user) {
    console.log("user---", user)
    if (bcrypt.compareSync(password, user.digest)) {
      done(null, user)
    } else {
      done(null, false)
    }
  })
}))

app.use(passport.initialize())
app.use(passport.session())

router.get("/", function *() {
  if (this.isAuthenticated()) {
    yield this.render("index")
  } else {
    yield this.render("login")
  }
})

router.post("/login", function *(next) {
  let ctx = this

  yield passport.authenticate("local", function *(err, user, info) {
    if (err) {
      throw err
    }

    if (user === false) {
      ctx.status = 401
      ctx.body = { success: false }
    } else {
      yield ctx.login(user)
      ctx.body = { success: true }
    }
  }).call(this, next)
})

router.get("/logout", function *() {
  this.logout()
  this.redirect("/")
})

router.get("/data", function *() {
  let results = yield r.db("quoth").table("users").run()

  this.type = "application/json"
  this.body = JSON.stringify(results)
})

app.use(router.middleware())

app.listen(3000, function () {
  console.log("Listening on port 3000.")
})
