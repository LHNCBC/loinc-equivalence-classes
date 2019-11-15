// The Drug/Tox class is handled almost the same as CHEM
let chemConfig = require('../class_CHEM/config');
let drugToxConfig = Object.assign(chemConfig, require('./config'));
let chemProcessor = require('../class_CHEM/processor');
chemProcessor('DRUG/TOX', drugToxConfig);
