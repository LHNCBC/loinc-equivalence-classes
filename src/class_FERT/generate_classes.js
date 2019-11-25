// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'FERT';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'PROPERTY_REV',
  'SCALE_REV'], async function(equivTable, util) {

  const clsConfig = require('./config');
  const equivConfig = require('../config');

  let {dupAndApplyGroups} = util;

  // PROPERTY_REV
  await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

  // SCALE_REV
  let scaleGroup = "OrdNomNarDoc";
  let groupData = {};
  groupData[scaleGroup] = equivConfig.SCALE[scaleGroup];
  await dupAndApplyGroups(equivTable, 'SCALE_TYP', groupData);
});
