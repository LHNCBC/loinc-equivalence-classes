//const mssql = require('mssql');
const sql = require('mssql/msnodesqlv8');
const equivConfig = require('../config');
const sqlUtilFactory = require('../util');

(async function () {
  let pool = await sql.connect({options: {trustedConnection: true}, server: 'ceb-mssql'});
  const equivTable = 'DRUGTOX_EQUIV';
  let util = sqlUtilFactory(pool);
  let query = util.query;
  let {dropTable, request, dupColumn, createHatless, applyGroup,
    applyGroupSkipPatterns, createEquivClasses, addMolecularWeights,
    equivSpreadsheet} = util;
  let drugToxConfig = require('./config');
  try {
    // Create OXYGEN_COMP table
    await dropTable('OXYGEN_COMP');
    await query('CREATE TABLE OXYGEN_COMP (Name nvarchar(255))');
    let oxygenStrings = equivConfig.COMPONENT.oxygen_related;
    let promises = oxygenStrings.map(async o2 => {await request().input('o2', o2).
      query('INSERT INTO OXYGEN_COMP VALUES (@o2)');});
    await Promise.all(promises);

    // Create the start of the equivalence class table
    await request().input('tableName', equivTable).input('className', 'DRUG/TOX').execute('create_equiv_table');
    //let result1 = await pool.request().query('select * from CHEM_METHOD');
    //console.log(JSON.stringify(result, null, 2));

    // PROPERTY_REV
    await dupColumn(equivTable, 'PROPERTY', 'PROPERTY_REV');
    for (let group of Object.keys(drugToxConfig.PROPERTY))
      await applyGroup(equivTable, 'PROPERTY_REV', drugToxConfig.PROPERTY[group], group);

    // TIME_REV
    await dupColumn(equivTable, 'TIME_ASPCT', 'TIME_REV');
    for (let group of Object.keys(drugToxConfig.TIME))
      await applyGroup(equivTable, 'TIME_REV', drugToxConfig.TIME[group], group);

    // SYSTEM_REV
    await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
    await createHatless(equivTable, 'COMPONENT');
    for (let group of ["Intravascular - any", "DuodGastricFld", "OcularVitrFld"]) {
      await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[group], group);
    }
    // For COMPONENTS in the oxygen group, we use different groups.  (Not really
    // needed for DrugTox, but will run the same code as for CHEM).
    let condition = 'COMPONENT_HATLESS in (select Name from OXYGEN_COMP)'
    for (let group of ["Arterial*", "Venous*"])
      await applyGroup(equivTable, 'SYSTEM_REV', drugToxConfig.SYSTEM[group], group, condition);

    // SCALE_REV
    await dupColumn(equivTable, 'SCALE_TYP', 'SCALE_REV');
    for (let group of Object.keys(drugToxConfig.SCALE))
      await applyGroup(equivTable, 'SCALE_REV', drugToxConfig.SCALE[group], group);

    // METHOD_REV
    await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV');
    let groupName = 'Method-Other';
    let skipPatterns = drugToxConfig.METHOD[groupName].skipPatterns;
    await applyGroupSkipPatterns(equivTable, 'METHOD_REV', skipPatterns, groupName);

    // Equivalance class name
    await createEquivClasses(equivTable, ['COMPONENT','PROPERTY_REV','TIME_REV',
      'SYSTEM_REV','SCALE_REV','METHOD_REV'])

    // Molecular weights column
    await addMolecularWeights(equivTable);

    // Genereate the output
    await equivSpreadsheet(equivTable);
  }
  catch (e) {
    console.log(e);
  }
  finally {
    await pool.close();
  }
})();

