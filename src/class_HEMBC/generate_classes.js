// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'HEM/BC';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'PROPERTY_REV',
  'SYSTEM_REV'], async function(equivTable, util) {

  const clsConfig = require('./config');
  const equivConfig = require('../config');

  let {dupAndApplyGroups} = util;

  // PROPERTY_REV
  await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

  // SYSTEM_REV
  let groupData = {};
  for (let name of ["Bld-any", "BLdCo-any", "DuodGastricFld"])
    groupData[name] = equivConfig.SYSTEM[name];
  await dupAndApplyGroups(equivTable, 'SYSTEM', groupData);
});
