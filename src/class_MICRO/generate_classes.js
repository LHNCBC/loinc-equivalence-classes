// TBD - When this is next done, this script should be revised to use
// "genTableAndResults"; see ABXBACT for an example.

// A program to generate equivalence classes.
const loincCls = 'MICRO';
const clsConfig = require('./config');
const equivConfig = require('../config'); // common configuration settings across classes

(async function() {
  const util = await require('../util').sqlUtil();

  let {query, dropTable, request, dupColumn, createHatless, applyGroup,
    applyGroupSkipPatterns, createEquivClasses, dupAndApplyGroups, applyGroups,
    equivSpreadsheet, closeConnection} = util;

  try {
    // Create table equivTable
    const equivTable = loincCls + '_EQUIV';
    await request().input('tableName', equivTable).input('className', loincCls).execute('create_equiv_table');

    // PROPERTY_REV
    await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

    // SYSTEM_REV
    await dupAndApplyGroups(equivTable, 'SYSTEM', clsConfig.SYSTEM);
    for (let group of ["Intravascular - any", "DuodGastricFld", "OcularVitrFld"])
      await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[group], group);
    // For COMPONENTCORE values that are STD-causing, we use a different set of
    // SYSTEM groups.  First, make a temporary table with the COMPONENT values
    // corresponding to the COMPONENTCORE patterns.  (Then we can re-use
    // applyGroups).
    await query("IF OBJECT_ID('tempdb..#COMPONENT_TEMP') IS NOT NULL DROP TABLE #COMPONENT_TEMP");
    let sql = "select distinct(COMPONENT) into #COMPONENT_TEMP from relma.dbo.LOINC lnc JOIN "+
     "relma.dbo.LOINC_DETAIL_TYPE_1 ldt on lnc.LOINC_NUM=ldt.LOINC_NUM WHERE COMPONENTCORE like '";
    sql += clsConfig.COMPONENTCORE.std_causing.join("' OR COMPONENTCORE like '") + "'";
    await query(sql);
    let condition = 'COMPONENT in (select COMPONENT from #COMPONENT_TEMP)';
    await applyGroups(equivTable, 'SYSTEM_REV', clsConfig.SYSTEM_STD, condition);

    // METHOD_REV
    await dupAndApplyGroups(equivTable, 'METHOD_TYP', clsConfig.METHOD);
    // Comment on group "IA--IF-Null*" (from Word document documentation):  We
    // also include null methods in this class but only when the analytes have
    // “Ab” or “Ag” in the name.
    await query('UPDATE '+equivTable +" set METHOD_REV='IA--IF-Null*' where "+
      "(METHOD_REV is null or METHOD_REV = '') and "+
      "(COMPONENT like '%[+. ]A[bg]' or COMPONENT like '%[+. ]A[bg][+. ]%')");

    // Equivalance class name
    await createEquivClasses(equivTable, ['COMPONENT','PROPERTY_REV',
      'SYSTEM_REV', 'METHOD_REV'])

    // Genereate the output
    await equivSpreadsheet(equivTable);
  }
  catch (e) {
    console.error(e);
    process.exit(1); // signal error
  }
  finally {
    await closeConnection();
  }
})();
