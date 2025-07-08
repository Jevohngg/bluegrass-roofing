// middleware/checkAuth.js
module.exports = function checkAuth(req, res, next) {
    if (req.session && req.session.admin) return next();
    return res.render('admin/login');
  };
  