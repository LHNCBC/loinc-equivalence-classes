// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'SERO';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'PROPERTY_REV',
  'SYSTEM_REV', 'METHOD_REV'], async function(equivTable, util) {

  const clsConfig = require('./config');
  const equivConfig = require('../config');

  let {query, dupColumn, applyGroups, dupAndApplyGroups} = util;

  // PROPERTY_REV
  await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

  // SYSTEM_REV
  let group = "Intravascular-any";
  let groupData = {};
  groupData[group] = equivConfig.SYSTEM[group];
  await dupAndApplyGroups(equivTable, 'SYSTEM', groupData);

  // METHOD_REV
  // Add group IA--If-Null* from MICRO
  await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV')
  await require('../class_MICRO/ia_if_null')(query, equivTable);
  clsConfig.METHOD["IA-IF-Null*"] =
    require('../class_MICRO/config.json').METHOD["IA-IF-Null*"];
  await applyGroups(equivTable, 'METHOD_REV', clsConfig.METHOD);
});

