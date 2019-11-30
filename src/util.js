const fs = require('fs');
const path = require('path');
const resultsDir = path.join(__dirname, '../results');

module.exports = {
  /**
   *  Returns an object of utility functions used by the various
   *  generate_classes.js programs.
   * @param pool A connection pool retured by
   *  require('mssql/msnodesqlv8').connect(...).
   */
  sqlUtilFactory: function (pool) {
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
       *  Creates a duplicate of the column with the values modified to remove
       *  text starting with ^ ("hat").
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
       *  Generates SQL conditions for the given column name and values.
       * @param req An SQL request object (obtained from request()).
       * @param boolStr Either 'AND' or 'OR' to be used in joining the
       *  conditions.
       * @param colName the name of the column for which the conditions are
       *  being generated.
       * @param vals the values to be used to compare with the column values.
       * @param conditionFn a function that takes a variable name for a value
       *  and the value from vals, and returns the SQL for the condition on that
       *  value.
       * @return an SQL fragment containing the requested conditions.
       */
      varConditions: function(req, boolStr, colName, vals, conditionFn) {
        let sql = '';
        boolStr = ' ' + boolStr + ' ';
        for (let i=0, len=vals.length; i<len; ++i) {
          if (i>0)
            sql += boolStr;
          let varName = 'var'+i;
          let val = vals[i];
          req.input(varName, val);
          sql += conditionFn(varName, val);
        }
        return sql;
      },


      /**
       *  Applies the group definition to the given column.  It sets column
       *  colName to groupValue where the values are currently one of the values
       *  in colValues (and the optional condition holds).
       * @param tableName the table containing the column
       * @param colName the column being revised
       * @param colValues the columnValues to be replaced
       * @param groupValue the new value replacing occurrences of colValues
       * @param condition and additional SQL string to limit the places the
       *  replacement is made.
       */
      applyGroup: async function(tableName, colName, colValues, groupValue, condition) {
        if (colValues.length >= 1) {
          await rtn._applyGroupWithOperator(tableName, colName, colValues,
            groupValue, '=', 'OR', condition);
        }
      },


      /**
       *  Calls applyGroup for the groups defined in "groups".
       * @param tableName the table containing the column being revised
       * @param colName the column being revised
       * @param groups the groups to apply.  This should be a hash from group
       *  names to array of column values that should be replaced with the group
       *  name.
       * @param condition and additional SQL string to limit the places the
       *  replacement is made.
       */
      applyGroups: async function(tableName, colName, groups, condition) {
        // First look for a default group.  The default group is only used if
        // one other other groups does not take effect.  The test of whether the
        // other groups take effect is to look for the group name in the column
        // after the other groups have been run, so we apply the default group
        // last.
        groups = JSON.parse(JSON.stringify(groups)); // copy so we can modify it
        let defaultGroupName, defaultGroupData;
        let groupNames = Object.keys(groups);
        for (let i=0, len=groupNames.length; i<len && !defaultGroupName; ++i) {
          let group = groupNames[i];
          let groupData = groups[group];
          if (groupData.default) {
            defaultGroupName = group;
            defaultGroupData = groupData;
            groupNames.splice(i, 1);  // remove from later processing
          }
        }
        // Apply the rest the groups.
console.log("%%% remaining groupNames="+groupNames);
        for (let group of groupNames) {
          await rtn.applyGroup(tableName, colName, groups[group], group, condition);
        }
        // Now handle the default, if any
        if (defaultGroupName) {
          // The only case we have is when there is also a "skipPatterns" key
          if (defaultGroupData.skipPatterns) {
            // Build a condition to exclude already applied groups.
            let appliedCond;
            for (let group of groupNames) {
              appliedCond = appliedCond ? appliedCond + ' AND ' : '';
              // Handle sub-parts (^)
              appliedCond += colName+"!='"+group + "' AND "+colName+" not like '"+group+"^%'";
            }
            if (condition)
              appliedCond = '('+condition+') AND ('+appliedCond+')';
            await rtn.applyGroupSkipPatterns(tableName, colName,
              defaultGroupData.skipPatterns, defaultGroupName, appliedCond);
          }
          else
            throw new Error("Configuration error:  unknown default specification");
        }
      },


      /**
       *  Duplicates the given column and applies the groups for that column.
       * @param equivTable the name of the equivalence table being constructed
       * @param colName the column name to duplicate and modify
       * @param groups the groups to apply.  This should be a hash from group
       *  names to array of column values that should be replaced with the group
       *  name.
       */
      dupAndApplyGroups: async function (equivTable, colName, groups) {
        // Remove _TYP or _ASPCT from the colName before appending _REV
        const colNameBase = colName.replace(/_(TYP|ASPCT)$/, '');
        const modColName = colNameBase + '_REV';
        await rtn.dupColumn(equivTable, colName, modColName);
        await rtn.applyGroups(equivTable, modColName, groups);
      },


      /**
       *   Revises a column values to all be the same shared name (groupValue)
       *   except in cases specified by conditionFn and conditionBool.
       *   Meant for internal use just by this module.
       * @param table the table containing the column
       * @param colName the column being revised
       * @param vals an array of values for use with conditionFn
       * @param groupValue the new value replacing values in colName
       * @param conditionFn a function that takes a variable name and one value
       *  from vals, and returns the SQL for a condition for that value.
       * @param conditionBool 'AND' or 'OR' to join the conditions returned by
       *  conditionFn for each val in vals.
       * @param globalCondition some additional SQL to AND with all of the other
       *  conditions generated by conditionFN.
       */
      _applyGroupConditionFn: async function(tableName, colName, vals, groupValue,
        conditionFn, conditionBool, globalCondition) {
        // Be careful of sub-parts.  We don't want to replace all the sub-parts,
        // just the first.
        // Example query to see the replacement this does:
        // select COMPONENT, concat('zzz', iif(PATINDEX('%^%', COMPONENT)>0, substring(COMPONENT, PATINDEX('%^%', COMPONENT),  LEN(COMPONENT)), '')) from relma.dbo.LOINC
        let sql = 'UPDATE '+ tableName + ' set '+colName+ " = concat('"+
           groupValue+"', iif(PATINDEX('%^%', "+colName+")>0, substring("+
           colName+", PATINDEX('%^%', "+colName+"),  LEN("+colName+")), '')) WHERE (";
        let req = rtn.request();
        sql += rtn.varConditions(req, conditionBool, colName, vals,
          conditionFn);
        sql += globalCondition ? ') AND ('+globalCondition+')' : ')';
        console.log(sql);
        await req.query(sql);
      },


      /**
       *   Revises a column values to all be the same shared name (groupValue)
       *   in cases where a generated condition holds true.  The condition is
       *   generated by comparing each value in vals against the first sub-part
       *   (the text up to "^") in column colName, using the operator
       *   conditionOp, and joining the several conditions together with
       *   conditionBool.  The conditions may be further modified with
       *   globalCondition, which is ANDed with the others.
       *   Meant for internal use just by this module.
       * @param table the table containing the column
       * @param colName the column being revised
       * @param vals an array of values for use with conditionOp
       * @param groupValue the new value replacing values in colName
       * @param conditionOp an operator to use in creating conditions between
       * the column values and the values in the vals parameter.
       * @param conditionBool 'AND' or 'OR' to join the conditions created for
       *  each value in vals.
       * @param globalCondition some additional SQL to AND with all of the other
       *  conditions generated for the values in vals.
       */
      _applyGroupWithOperator: async function(tableName, colName, vals, groupValue,
        conditionOp, conditionBool, globalCondition) {

        // Be careful of sub-parts.  Allow vals to match just the first sub-part, if there are sub-parts.
        await rtn._applyGroupConditionFn(tableName, colName, vals, groupValue,
          varName=>"iif(PATINDEX('%^%', "+colName+")>0, substring("+
          colName+", 0, PATINDEX('%^%', "+colName+")), "+colName+") "+
          conditionOp+" @"+varName, conditionBool, globalCondition);
      },


      /**
       *   Revises a column values to all be the same shared name (groupValue)
       *   except where the existing value matches one of the patterns in
       *   skipPatterns.
       * @param table the table containing the column
       * @param colName the column being revised
       * @param skipPatterns an array of SQL patterns
       * @param groupValue the new value replacing values in colName
       * @param globalCondition some additional SQL to AND with all of the other
       *  conditions generated for the values in skipPatterns.
       */
      applyGroupSkipPatterns: async function(tableName, colName, skipPatterns,
        groupValue, globalCondition) {

        await rtn._applyGroupWithOperator(tableName, colName, skipPatterns,
          groupValue, 'NOT LIKE', 'AND', globalCondition);
      },


      /**
       *   Revises a column values to all be the same shared name (groupValue)
       *   except where the existing value matches one of the values in
       *   skipValues.
       * @param table the table containing the column
       * @param colName the column being revised
       * @param skipValues an array of values to be skipped
       * @param groupValue the new value replacing values in colName
       */
      applyGroupSkipValues: async function(tableName, colName, skipValues, groupValue) {
        await rtn._applyGroupWithOperator(tableName, colName, skipValues,
          groupValue, '!=', 'AND');
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
      },


      /**
       *  Generates the output spreadsheet.
       * @param equivTable the table with the equivalence class data.  The method
       *  sorts and organizes that data in way more suitable for review and presentation.
       *  Assumption:  equivTable is named in the form "[LOINC_CLASS]_EQUIV" where
       *  LOINC_CLASS is the same string used in the class-specific
       *  sub-directories (so we can find the template files).
       * @param
       */
      equivSpreadsheet: async function(equivTable) {
        let loincCls = equivTable.slice(0, -6); // remove "_EQUIV"
        let clsSubDir = 'class_'+loincCls;
        const path = require('path');
        const exceljs = require('exceljs');
        let workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(path.join(__dirname, clsSubDir, 'results_template.xlsx'));

        // There are two sheets, one where we include all of the equivalance classes, and one
        // where we include only those classes with a count > 1.  So, we run through the code below twice.
        for (let includeAll of [false, true]) {
          // Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
          let sql =
            "IF OBJECT_ID('tempdb..#EQUIV_TEMP') IS NOT NULL DROP TABLE #EQUIV_TEMP\n"+
            "select EQUIV_CLS as heading, * into #EQUIV_TEMP\n"+
            "from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From "+equivTable+") t";
          sql += includeAll? "\n" : " where CLS_COUNT > 1\n";
          sql +=
            "order by EQUIV_CLS\n"+
            "UPDATE #EQUIV_TEMP set heading = '';\n"+
            "EXEC dup_column '#EQUIV_TEMP', 'EQUIV_CLS', 'SORT_ORDER'"
          await rtn.query(sql);

          // Add heading rows with count
          let countField = 'LONG_COMMON_NAME';
          await rtn.query("insert into #EQUIV_TEMP (heading, "+countField+", SORT_ORDER) select EQUIV_CLS,\n"+
            "count(EQUIV_CLS), EQUIV_CLS as EQUIV_CLS from #EQUIV_TEMP group by EQUIV_CLS;");

          // Add blank row after group
          await rtn.query("insert into #EQUIV_TEMP (heading, "+countField+", SORT_ORDER) select '', '',\n"+
            "EQUIV_CLS + '_BLANKROW' from #EQUIV_TEMP where EQUIV_CLS is not null group by EQUIV_CLS;\n");

          // Set other fields to blank in the heading rows and blank rows except SORT_ORDER (used for sorting)
          // This avoids having to respecify the fields in the table.
          await rtn.query("DECLARE @sql varchar(max)=''\n"+
            "select @sql= @sql+case when c.name!='heading' and c.name != 'SORT_ORDER' and c.name != '"+
               countField+"' then c.name + '='''',\n"+
            "' else '' end from tempdb.sys.columns c where object_id =\n"+
            "object_id('tempdb..#EQUIV_TEMP');\n"+
            "select @sql = substring(@sql, 1, (len(@sql) - 2))\n"+  // remove last comma
            "SET @sql = 'UPDATE #EQUIV_TEMP SET '+@sql + ' where COMPONENT is NULL'");

          let colData = await rtn.query("select * from tempdb.sys.columns c where object_id =\n"+
            "object_id('tempdb..#EQUIV_TEMP')");
          let colNames = colData.recordsets[0].reduce((acc, row)=>{acc[row.name] = true; return acc}, {});
          let outputCols = ['EQUIV_CLS', 'LOINC_NUM', 'COMPONENT']
          if (colNames['COMPONENT_REV'])
            outputCols.push('COMPONENT_REV');
          outputCols.push('EXAMPLE_UCUM_UNITS');
          if (colNames['PROPERTY_REV'])
            outputCols.push('PROPERTY', 'PROPERTY_REV');
          if (colNames['TIME_REV'])
            outputCols.push('TIME_ASPCT', 'TIME_REV');
          if (colNames['SYSTEM_REV'])
            outputCols.push('SYSTEM', 'SYSTEM_REV');
          if (colNames['SCALE_REV'])
            outputCols.push('SCALE_TYP', 'SCALE_REV');
          if (colNames['METHOD_REV'])
            outputCols.push('METHOD_TYP', 'METHOD_REV');
          outputCols.push('LONG_COMMON_NAME')
          if (colNames['MOLECULAR_WEIGHT'])
            outputCols.push('MOLECULAR_WEIGHT');
          if (colNames['WARNING'])
            outputCols.push('WARNING');
          outputCols.push('SORT_ORDER');

          let results = await rtn.query("select heading as 'Heading', "+outputCols.join(', ')+
            " from #EQUIV_TEMP order by SORT_ORDER, heading desc, LOINC_NUM");

          // Write sheet
          let sheetName = includeAll ? 'all groups' : 'group size > 1';
          let worksheet = workbook.getWorksheet(sheetName);
          worksheet.spliceRows(0, worksheet.rowCount); // remove existing rows
          outputCols.unshift('Heading');
          worksheet.addRow(outputCols);
          let dataRows =  [];
          for (let rowObj of results.recordsets[0]) {
            let row = [];
            for (let col of outputCols)
              row.push(rowObj[col]);
            dataRows.push(row);
          }
          worksheet.addRows(dataRows);
        }

        // Write the output file
        if (!fs.existsSync(resultsDir))
          fs.mkdirSync(resultsDir);
        await workbook.xlsx.writeFile(module.exports.resultsPathname(loincCls));
      },


      /**
       *  Closes the connetion with the server.
       */
      closeConnection: async ()=>await pool.close()
    };

    return rtn;
  },

  /**
   *  Creates a connection pool, and calls sqlUtilFactory to create the returned
   *  object of utility functions.  (It is not clear yet whether sqlUtilFactory
   *  needs to be exported.)
   */
  sqlUtil: async function() {
    const sql = require('mssql/msnodesqlv8');
    let pool = await sql.connect({options: {trustedConnection: true}, server: 'ceb-mssql'});
    return module.exports.sqlUtilFactory(pool);
  },


  /**
   *  Establishes an SQL connection, creates the equivalence table, applies the
   *  given editing function to the table, and generates the results output
   *  spreadsheet.
   * @param loincCls the name of the LOINC class for which we are creating
   *  equivalence classes.
   * @param equivNameCols an array of column names to use in constructing the
   *  equivalence class name.
   * @param editFn the function that will be used to edit the equivalence class
   *  table.  This will be passed the name of the table and the return value of
   *  "sqlUtil".
   */
  genTableAndResults: async function(loincCls, equivNameCols, editFn) {
    const util = await module.exports.sqlUtil();
    let {request, createEquivClasses, equivSpreadsheet, closeConnection} = util;
    try {
      // Create the table
      const equivTable = loincCls.replace(/\//g, '') + '_EQUIV'; // remove / from class strings
      await request().input('tableName', equivTable).input('className', loincCls).execute('create_equiv_table');

      // Edit the table
      await editFn(equivTable, util);

      // Equivalance class name
      await createEquivClasses(equivTable, equivNameCols)

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
  },


  /**
   *  Returns the results file pathname, given the class name.
   * @param loincCls the LOINC class name
   */
  resultsPathname: function (loincCls) {
    return path.join(resultsDir, loincCls + '_results.xlsx');
  }
}
