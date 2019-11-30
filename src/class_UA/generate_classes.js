// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'UA';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'PROPERTY_REV',
  'SYSTEM_REV'], async function(equivTable, util) {

  const clsConfig = require('./config');

  let {dupAndApplyGroups} = util;

  // PROPERTY_REV
  await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

  // SYSTEM_REV
  await dupAndApplyGroups(equivTable, 'SYSTEM', clsConfig.SYSTEM);
});

