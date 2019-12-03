// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'FERT';

require('../util').genTableAndResults(loincCls, ['COMPONENT',
  'SCALE_REV'], async function(equivTable, util) {

  const equivConfig = require('../config');

  let {dupAndApplyGroups} = util;

  // SCALE_REV
  let scaleGroup = "OrdNomNarDoc";
  let groupData = {};
  groupData[scaleGroup] = equivConfig.SCALE[scaleGroup];
  await dupAndApplyGroups(equivTable, 'SCALE_TYP', groupData);
});
