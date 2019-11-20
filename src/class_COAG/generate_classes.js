// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'COAG';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'PROPERTY_REV',
  'SYSTEM_REV', 'METHOD_REV'], async function(equivTable, util) {

  const clsConfig = require('./config');

  let {request, query, dupColumn, dupAndApplyGroups, applyGroupSkipValues} = util;

  // PROPERTY_REV
  await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

  // SYSTEM_REV
  await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
  let groupName = "Intravascular - any";
  let sysCoreVals = clsConfig.SYSTEMCORE[groupName];
  // In this case, we want to only replace the first sub-part, and leave the
  // second subpart (the "super system") as is.  Note that sometimes the
  // "system" values can be values from "super system".
  // First assign the group name to any row whose SYSTEMCORE matches the values.
  let sql = 'UPDATE '+equivTable + " set SYSTEM_REV = '"+groupName+
    "' where LOINC_NUM in (select LOINC_NUM from relma.dbo.LOINC_DETAIL_TYPE_1";
  let req = request();
  for (let i=0, len=sysCoreVals.length; i<len; ++i) {
    sql += i===0 ? ' where ' : ' OR ';
    let varName = 'var'+i;
    req.input(varName, sysCoreVals[i]);
    sql += "SYSTEMCORE = @"+varName;
  }
  sql += ')'
  console.log(sql);
  await req.query(sql);
  // Now restore the super system
  await query('UPDATE '+equivTable +
    " set SYSTEM_REV = concat(SYSTEM_REV, '^', SYSTEMSUPERSYSTEM) from "+
    equivTable+" eq join relma.dbo.LOINC_DETAIL_TYPE_1 ltd on eq.LOINC_NUM = ltd.LOINC_NUM"+
    " WHERE SYSTEMSUPERSYSTEM is not NULL and SYSTEM_REV='"+groupName+"'");

  // METHOD_REV
  await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV');
  groupName = 'Method-Other';
  skipValues = clsConfig.METHOD[groupName].skip;
  await applyGroupSkipValues(equivTable, 'METHOD_REV', skipValues, groupName);
});
