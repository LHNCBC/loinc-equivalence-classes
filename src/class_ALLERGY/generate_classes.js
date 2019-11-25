// TBD - When this is next done, this script should be revised to use
// "genTableAndResults"; see ABXBACT for an example.

// A program to generate equivalence classes.
const loincCls = 'ALLERGY';
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
    await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
    let groupName = "Intravascular-any";
    await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[groupName], groupName);

    // SCALE_REV
    await dupColumn(equivTable, 'SCALE_TYP', 'SCALE_REV');
    let condition = "COMPONENT NOT LIKE 'RAST%' and COMPONENT NOT LIKE '%.RAST%'"
    groupName = "OrdNomNarDoc";
    await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SCALE[groupName],
      groupName, condition);

    // Equivalance class name
    await createEquivClasses(equivTable, ['COMPONENT','PROPERTY_REV',
      'SYSTEM_REV', 'SCALE_REV'])

    // Genereate the output
    await equivSpreadsheet(equivTable);
  }
  catch (e) {
    console.log(e);
  }
  finally {
    await closeConnection();
  }
})();
