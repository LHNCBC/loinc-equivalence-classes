// The Drug/Tox class is handled almost the same as CHEM
const chemConfig = require('../class_CHEM/config');
const equivConfig = require('../config'); // common configuration settings across classes
const scaleGroup = "OrdNomNarDoc";
// Modify CHEM's config for Drug/Tox
chemConfig.SCALE = {};
chemConfig.SCALE[scaleGroup] = equivConfig.SCALE[scaleGroup];
const chemProcessor = require('../class_CHEM/processor');
chemProcessor('DRUG/TOX', chemConfig);
