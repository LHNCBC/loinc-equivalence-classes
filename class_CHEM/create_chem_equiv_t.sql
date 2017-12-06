-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable "CHEM_EQUIV"
:setvar systemTable "CHEM_SYSTEM"

-- Copy source table
EXEC create_equiv_table $(equivTable), 'CHEM'
GO

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
EXEC apply_groups $(equivTable), 'SYSTEM_REV', $(systemTable), 'System_Rev_1';
-- Apply System_Rev2 if the COMPONENT is in the oxygen component list
UPDATE $(equivTable) set SYSTEM_REV = g.System_Rev_2 from $(equivTable) left join
  $(systemTable) g on SYSTEM=g.Name where COMPONENT in (select Name from CHEM_OXYGEN_COMP)
  and g.System_Rev_2 is not null;

-- Property column --
EXEC dup_column $(equivTable), 'PROPERTY', 'PROPERTY_REV'
GO
EXEC apply_groups $(equivTable), 'PROPERTY_REV', 'CHEM_PROPERTY', 'Property_Rev';

-- METHOD column--
EXEC dup_column $(equivTable), 'METHOD_TYP', 'METHOD_REV'
GO
EXEC apply_groups $(equivTable), 'METHOD_REV', 'CHEM_METHOD', 'Method_Rev';

-- Time column
EXEC dup_column $(equivTable), 'TIME_ASPCT', 'TIME_REV'
GO
EXEC apply_groups $(equivTable), 'TIME_REV', 'CHEM_TIME', 'Time_Rev';

-- Warning column
ALTER TABLE $(equivTable) ADD WARNING nvarchar(255);
GO
UPDATE $(equivTable) set WARNING = '';
UPDATE $(equivTable) set WARNING = g.Comp_Warning from $(equivTable) left join CHEM_COMPONENT g
  on COMPONENT=g.Name where (Warning_Check = 'Equal' and SYSTEM=Warning_System) OR
  (Warning_Check = 'Not equal' and SYSTEM=Warning_System)


-- Build the equivalance class name
ALTER TABLE $(equivTable) ADD EQUIV_CLS nvarchar(255);
GO
UPDATE $(equivTable) set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY_REV,'|',SYSTEM_REV,'|',METHOD_REV,'|',TIME_REV);

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
IF OBJECT_ID('tempdb..#EQUIV_TEMP') IS NOT NULL DROP TABLE #EQUIV_TEMP
select EQUIV_CLS as heading, * into #EQUIV_TEMP
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From $(equivTable)) t  where CLS_COUNT > 1
  order by EQUIV_CLS
UPDATE #EQUIV_TEMP set heading = '';
insert into #EQUIV_TEMP (heading, EQUIV_CLS) select distinct(EQUIV_CLS) as heading, EQUIV_CLS as EQUIV_CLS from #EQUIV_TEMP;
EXEC dup_column '#EQUIV_TEMP', 'EQUIV_CLS', 'EQUIV_ORDER'
GO

-- Set other fields to blank in the heading rows except EQUIV_ORDER (used for sorting)
-- This avoids having to respecify the fields in the table.
DECLARE @sql varchar(max)=''
select @sql= @sql+case when c.name!='heading' and c.name != 'EQUIV_ORDER' then c.name + '='''',
' else '' end from tempdb.sys.columns c where object_id =
object_id('tempdb..#EQUIV_TEMP');
select @sql = substring(@sql, 1, (len(@sql) - 3)) -- remove last comma
SET @sql = 'UPDATE #EQUIV_TEMP SET '+@sql + ' where heading != '''''
EXECUTE (@sql)


select * from #EQUIV_TEMP order by EQUIV_ORDER, heading desc

