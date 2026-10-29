const express = require('express');
const replyRulesController = require('../controllers/replyRulesController');
const validate = require('../middleware/validate');
const { idParams, ruleBody } = require('../schemas/replyRulesSchemas');

const router = express.Router();

router.get('/', replyRulesController.list);
router.post('/', validate({ body: ruleBody }), replyRulesController.create);
router.put('/:id', validate({ params: idParams, body: ruleBody }), replyRulesController.update);
router.delete('/:id', validate({ params: idParams }), replyRulesController.remove);

module.exports = router;
