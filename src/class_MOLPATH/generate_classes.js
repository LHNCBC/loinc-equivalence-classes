// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'MOLPATH';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'SYSTEM_REV'],
  async function(equivTable, util) {

  const clsConfig = require('./config');

  let {dupAndApplyGroups} = util;

  // SYSTEM_REV
  await dupAndApplyGroups(equivTable, 'SYSTEM', clsConfig.SYSTEM);
});
