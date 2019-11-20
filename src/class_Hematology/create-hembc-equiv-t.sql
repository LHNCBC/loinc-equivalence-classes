-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable "HEMBC_EQUIV"

-- Copy source table
EXEC create_equiv_table $(equivTable), 'HEM/BC'
GO

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
EXEC apply_groups $(equivTable), 'SYSTEM_REV', 'HEMBC_SYSTEM', 'System_Rev_1';


-- Property column --
EXEC dup_column $(equivTable), 'PROPERTY', 'PROPERTY_REV'
GO
EXEC apply_groups $(equivTable), 'PROPERTY_REV', 'HEMBC_PROPERTY', 'Property_Rev';


-- Build the equivalance class name
ALTER TABLE $(equivTable) ADD EQUIV_CLS nvarchar(255);
GO
UPDATE $(equivTable) set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY_REV,'|',SYSTEM_REV,'|Method_Any');

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
IF OBJECT_ID('tempdb..#EQUIV_TEMP') IS NOT NULL DROP TABLE #EQUIV_TEMP
select EQUIV_CLS as heading, * into #EQUIV_TEMP
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From $(equivTable)) t  where CLS_COUNT > 1
  order by EQUIV_CLS
UPDATE #EQUIV_TEMP set heading = '';
EXEC dup_column '#EQUIV_TEMP', 'EQUIV_CLS', 'SORT_ORDER'
GO
-- Add heading rows with count
:setvar countField SYSTEM_REV
insert into #EQUIV_TEMP (heading, $(countField), SORT_ORDER) select EQUIV_CLS,
  count(EQUIV_CLS), EQUIV_CLS as EQUIV_CLS from #EQUIV_TEMP group by EQUIV_CLS;

-- Add blank row after group
insert into #EQUIV_TEMP (heading, $(countField), SORT_ORDER) select '', '',
  EQUIV_CLS + '_BLANKROW' from #EQUIV_TEMP where EQUIV_CLS is not null group by EQUIV_CLS;

-- Set other fields to blank in the heading rows and blank rows except SORT_ORDER (used for sorting)
-- This avoids having to respecify the fields in the table.
DECLARE @sql varchar(max)=''
select @sql= @sql+case when c.name!='heading' and c.name != 'SORT_ORDER' and c.name != '$(countField)' then c.name + '='''',
' else '' end from tempdb.sys.columns c where object_id =
object_id('tempdb..#EQUIV_TEMP');
select @sql = substring(@sql, 1, (len(@sql) - 3)) -- remove last comma
SET @sql = 'UPDATE #EQUIV_TEMP SET '+@sql + ' where COMPONENT is NULL'
EXECUTE (@sql)

select heading as 'Heading', EQUIV_CLS, LOINC_NUM, COMPONENT, PROPERTY, PROPERTY_REV,
 SYSTEM, SYSTEM_REV, METHOD_TYP, LONG_COMMON_NAME,
 SORT_ORDER from #EQUIV_TEMP order by SORT_ORDER, heading desc

