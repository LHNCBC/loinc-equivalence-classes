//const mssql = require('mssql');
const sql = require('mssql/msnodesqlv8');
const equivConfig = require('../config');

function sqlUtilFactory(pool) {
  var rtn = {
    /**
     *  Excecutes the given sql string.
     */
    query: async function (sql) {
      console.log(sql);
      return await pool.request().query(sql);
    },


    /**
     *  Returns an object for building and SQL request.
     */
    request: function () {
      return pool.request();
    },


    /**
     *  Drops the given table name, if it exists.  Do not call with data.  The parameter is not
     *  santized.
     */
    dropTable: async function(tableName) {
      return rtn.query("IF OBJECT_ID('"+tableName+"', 'U') IS NOT NULL DROP TABLE "+
         tableName);
    },


    /**
     *  Duplicates a column, creating a new column in the same table.
     * @param tableName the name of the table containing the columns
     * @param soureCol the existing column to be copied
     * @param destCol the new column to be creatd.
     */
    dupColumn: async function(tableName, sourceCol, destCol) {
     return await rtn.request().input('tableName', tableName).
       input('sourceCol', sourceCol).input('destCol', destCol).execute('dup_column');
    },


    /**
     *  Creates a version of column with the all text starting with ^ ("hat")
     *  removed.
     * @param tableName the name of the table containing the column.  This
     *  parameter is not santized, so only pass trusted strings.
     * @param colName the name of the column to duplicate and modify.  The new column will
     *  be named colName +  '_HATLESS'.
     *  This parameter is not santized, so only pass trusted strings.
     */
    createHatless: async function(tableName, colName) {
      let hatlessCol = colName + '_HATLESS';
      await rtn.dupColumn(tableName, colName, hatlessCol);
      return await rtn.query('UPDATE '+tableName+' set '+hatlessCol+" = LEFT("+
        hatlessCol+", PATINDEX('%^%', "+hatlessCol+")-1) where "+hatlessCol+" like '%^%'");
      return
    },


    /**
     *  Applies the group definition to the given column.
     * @param table the table containing the column
     * @param colName the column being revised
     * @param colValues the columnValues to be replaced
     * @param groupValue the new value replacing occurrences of colValues
     * @param condition and additional SQL string to limit the places the
     *  replacement is made.
     */
    applyGroup: async function(tableName, colName, colValues, groupValue, condition) {
      if (colValues.length > 1) {
        let sql = 'UPDATE '+ tableName + ' set '+colName+ " = '"+groupValue+"'";
        let req = rtn.request();
        for (let i=0, len=colValues.length; i<len; ++i) {
          sql += i===0 ? ' WHERE (' : ' OR ';
          let varName = 'var'+i;
          req.input(varName, colValues[i]);
          sql += colName + '=@'+varName;
        }
        sql += ')';
        if (condition)
          sql += ' AND ('+condition+')';
        await req.query(sql);
      }
    },


    /**
     *   Revises a column values to all be the same shared name (groupValue)
     *   except where the existing value matches one of the patterns in
     *   skipPatterns.
     * @param table the table containing the column
     * @param colName the column being revised
     * @param skipPatterns an array of SQL patterns (which can begin or end in %
     *  for limited wildcard matching)
     * @param groupValue the new value replacing values in colName
     */
    applyGroupSkipPatterns: async function(tableName, colName, skipPatterns, groupValue) {
      let sql = 'UPDATE '+ tableName + ' set '+colName+ " = '"+groupValue+"'";
      let req = rtn.request();
      for (let i=0, len=skipPatterns.length; i<len; ++i) {
        sql += i===0 ? ' WHERE ' : ' AND ';
        let varName = 'var'+i;
        req.input(varName, skipPatterns[i]);
        sql += colName + " NOT LIKE @"+varName;
      }
      console.log(sql);
      await req.query(sql);
    },


    /**
     *  Creates the equivalence class column and generates the equivalance class
     *  values.
     * @param tableName the table to which the column will be added
     * @param colNames an array of the column names from which the equivalence
     *  class should be constructed.
     */
    createEquivClasses: async function(tableName, colNames) {
      await rtn.query('ALTER TABLE '+tableName+' ADD EQUIV_CLS nvarchar(255)');
      let sql = 'UPDATE '+tableName+' set EQUIV_CLS=CONCAT('+colNames.join(",'|',")+')';
      await rtn.query(sql);
    },

    /**
     *  Adds a molecular weights column to the given table.
     * @param tableName the table to which the column will be added
     */
    addMolecularWeights: async function (tableName) {
      await rtn.query('ALTER TABLE '+tableName+' ADD MOLECULAR_WEIGHT float');
      await rtn.query('UPDATE '+tableName+' set MOLECULAR_WEIGHT = mw.Molecular_weight_COMBINED from '+
        tableName+' eq left join relma.dbo.PART pt on eq.COMPONENT = pt.PART '+
         ' left join MOLECULAR_WEIGHTS mw on pt.PART_NUM = mw.PartNum where pt.TYPE=1');
    }
  };

  return rtn;
}

(async function () {
  let pool = await sql.connect({options: {trustedConnection: true}, server: 'ceb-mssql'});
  const equivTable = 'DRUGTOX_EQUIV';
  let util = sqlUtilFactory(pool);
  let query = util.query;
  let {dropTable, request, dupColumn, createHatless, applyGroup,
    applyGroupSkipPatterns, createEquivClasses, addMolecularWeights} = util;
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
  }
  catch (e) {
    console.log(e);
  }
  finally {
    await pool.close();
  }
})();

