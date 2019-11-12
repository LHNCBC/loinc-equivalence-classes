/**
 *  The processing function for CHEM.  It is in this separate file so that it can
 *  also be used for DRUGTOX.
 * @param loincCls The LOINC class to process
 * @param clsConfig The config file data for this LOINC class.
 */
module.exports = async function (loincCls, clsConfig) {
  const sql = require('mssql/msnodesqlv8');
  const equivConfig = require('../config'); // common configuration settings across classes
  const sqlUtilFactory = require('../util');

  let pool = await sql.connect({options: {trustedConnection: true}, server: 'ceb-mssql'});
  let util = sqlUtilFactory(pool);
  let query = util.query;
  let {dropTable, request, dupColumn, createHatless, applyGroup,
    applyGroupSkipPatterns, createEquivClasses, addMolecularWeights,
    equivSpreadsheet} = util;
  const equivTable = loincCls.replace(/\//g, '')+'_EQUIV';

  try {
    // Create OXYGEN_COMP table
    await dropTable('OXYGEN_COMP');
    await query('CREATE TABLE OXYGEN_COMP (Name nvarchar(255))');
    let oxygenStrings = equivConfig.COMPONENT.oxygen_related;
    let promises = oxygenStrings.map(async o2 => {await request().input('o2', o2).
      query('INSERT INTO OXYGEN_COMP VALUES (@o2)');});
    await Promise.all(promises);

    // Create the start of the equivalence class table
    await request().input('tableName', equivTable).input('className', loincCls).execute('create_equiv_table');

    // PROPERTY_REV
    await dupColumn(equivTable, 'PROPERTY', 'PROPERTY_REV');
    for (let group of Object.keys(clsConfig.PROPERTY))
      await applyGroup(equivTable, 'PROPERTY_REV', clsConfig.PROPERTY[group], group);
    // One of the property groups equivlances MFr.DF and SFr.DF with non-DF
    // equivalents.  We need to set units for the DF entries for the conversion
    // to work.
    await query('UPDATE '+equivTable+ " set EXAMPLE_UCUM_UNITS = '%/100' where "+
       "PROPERTY = 'MFr.DF' or PROPERTY = 'SFr.DF'");

    // TIME_REV
    await dupColumn(equivTable, 'TIME_ASPCT', 'TIME_REV');
    for (let group of Object.keys(clsConfig.TIME))
      await applyGroup(equivTable, 'TIME_REV', clsConfig.TIME[group], group);

    // SYSTEM_REV
    await dupColumn(equivTable, 'SYSTEM', 'SYSTEM_REV');
    for (let group of ["Intravascular - any", "DuodGastricFld", "OcularVitrFld"]) {
      await applyGroup(equivTable, 'SYSTEM_REV', equivConfig.SYSTEM[group], group);
    }
    // For COMPONENTS in the oxygen group, we use different groups.  (Not really
    // needed for DrugTox, but will run the same code as for CHEM).
    await createHatless(equivTable, 'COMPONENT');
    let condition = 'COMPONENT_HATLESS in (select Name from OXYGEN_COMP)'
    for (let group of ["Arterial*", "Venous*"])
      await applyGroup(equivTable, 'SYSTEM_REV', clsConfig.SYSTEM[group], group, condition);

    // SCALE_REV
    await dupColumn(equivTable, 'SCALE_TYP', 'SCALE_REV');
    for (let group of Object.keys(clsConfig.SCALE))
      await applyGroup(equivTable, 'SCALE_REV', clsConfig.SCALE[group], group);

    // METHOD_REV
    await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV');
    let groupName = 'Method-Other';
    let skipPatterns = clsConfig.METHOD[groupName].skipPatterns;
    await applyGroupSkipPatterns(equivTable, 'METHOD_REV', skipPatterns, groupName);

    // Equivalance class name
    await createEquivClasses(equivTable, ['COMPONENT_HATLESS','PROPERTY_REV','TIME_REV',
      'SYSTEM_REV','SCALE_REV','METHOD_REV'])

    // Molecular weights column
    await addMolecularWeights(equivTable);

    // Add Warnings column.  So far only CHEM has data for this, but we will let
    // it run for Drug/Tox'.
    await query('ALTER TABLE '+equivTable+' ADD WARNING nvarchar(255)');
    let warnings = clsConfig.warning
    for (let warning of warnings) {
      let req = request();
      req.input('msg', warning.message);
      let conditions = warning.conditions;
      let queryStr = 'UPDATE '+equivTable+' set WARNING = @msg ';
      let condCols = Object.keys(conditions);
      for (let i=0, len=condCols.length; i<len; ++i) {
        queryStr += i===0 ? ' WHERE (' : ') AND (';
        let col = condCols[i];
        let vals = conditions[col];
        for (let j=0, jLen=vals.length; j<jLen; ++j) {
          if (j != 0)
            queryStr += ' OR '
          let valInput = col+j;
          req.input(valInput, vals[j]);
          queryStr += col +'=@' + valInput;
        }
      }
      queryStr += ')';
      await req.query(queryStr);
    }

    // Genereate the output
    await equivSpreadsheet(equivTable);
  }
  catch (e) {
    console.log(e);
  }
  finally {
    await pool.close();
  }
}
