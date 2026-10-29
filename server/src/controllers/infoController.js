const infoService = require('../services/infoService');

function get(_req, res) {
  res.json(infoService.getInfo());
}

module.exports = { get };
