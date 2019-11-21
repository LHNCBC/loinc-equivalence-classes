// A program to generate the equivalence classes for CELLMARK
const loincCls = 'CELLMARK';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'SYSTEM_REV', 'SCALE_REV'],
  async function(equivTable, util) {

  const equivConfig = require('../config'); // common configuration settings across classes

  let {dupColumn, applyGroup} = util;

  // SYSTEM_REV
  await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
  let groupName = "Intravascular - any";
  await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[groupName], groupName);

  // SCALE_REV
  await dupColumn(equivTable, 'SCALE_TYP', 'SCALE_REV');
  groupName = "OrdNomNarDoc";
  await applyGroup(equivTable, 'SCALE_REV', equivConfig.SCALE[groupName], groupName);
});
