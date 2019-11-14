const equivTable = 'MICRO_EQUIV';
const clsConfig = require('./config');
const equivConfig = require('../config'); // common configuration settings across classes

(async function() {
  try {
    const util = await require('../util').sqlUtil();

    let {query, dropTable, request, dupColumn, createHatless, applyGroup,
      applyGroupSkipPatterns, createEquivClasses, addMolecularWeights,
      equivSpreadsheet, closeConnection} = util;

    // PROPERTY_REV
    await dupColumn(equivTable, 'PROPERTY', 'PROPERTY_REV');
    for (let group of Object.keys(clsConfig.PROPERTY))
      await applyGroup(equivTable, 'PROPERTY_REV', clsConfig.PROPERTY[group], group);

    // SYSTEM_REV
    await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
    for (let group of Object.keys(clsConfig.SYSTEM))
      await applyGroup(equivTable, 'SYSTEM_REV', clsConfig.SYSTEM[group], group);
    // For COMPONENTCORE values that are STD-causing, we use a different set of
    // SYSTEM groups.  First, make a temporary table with the COMPONENT values
    // corresponding to the COMPONENTCORE patterns.  (Then we can re-use
    // applyGroup).
    await query("IF OBJECT_ID('tempdb..#COMPONENT_TEMP') IS NOT NULL DROP TABLE #COMPONENT_TEMP");
    let sql = "select distinct(COMPONENT) into #COMPONENT_TEMP from relma.dbo.LOINC lnc JOIN "+
     "relma.dbo.LOINC_DETAIL_TYPE_1 ldt on lnc.LOINC_NUM=ldt.LOINC_NUM WHERE COMPONENTCORE like '";
    sql += clsConfig.COMPONENTCORE.std_causing.join("' OR COMPONENTCORE like '") + "'";
    await query(sql);
    let condition = 'COMPONENT in (select COMPONENT from #COMPONENT_TEMP)';
    for (let group of Object.keys(clsConfig.SYSTEM_STD))
      applyGroup(equivTable, 'SYSTEM_REV', clsConfig.SYSTEM_STD[group], group);
  }
  catch (e) {
    console.log(e);
  }
  finally {
    await closeConnection();
  }
})();
