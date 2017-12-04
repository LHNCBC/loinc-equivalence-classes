-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable "SERO_EQUIV"
:setvar systemTable "SERO_SYSTEM"
:setvar systemGroupCol "System_Rev"


-- Copy source table
EXEC create_equiv_table $(equivTable), 'SERO'
GO

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
-- Clean up the system grouping table before using it.  (This only has to run
-- once, but it won't hurt to leave it in case we reload the table.)
UPDATE $(systemTable) set $(systemGroupCol) = RTRIM(LTRIM($(systemGroupCol)));
-- Now use the system table to update SYSTEM_REV in the equivalence table.
if object_id('apply_groups') is not NULL
   DROP PROCEDURE apply_groups;
GO
-- Copies in the group information from the group table
CREATE PROCEDURE apply_groups @equivTable nvarchar(255), @equivTableCol nvarchar(255),
 @groupTable nvarchar(255), @groupTableCol nvarchar(255)
as
BEGIN
  DECLARE @sql nvarchar(255);
 -- UPDATE @groupTable set @groupTableCol = RTRIM(LTRIM(@groupTableCol));
  SET @sql = N'update '+quotename(@groupTable)+
    N' set '+quotename(@groupTableCol) + N'=RTRIM(LTRIM('+quotename(@groupTableCol)+'));'
  EXEC sp_executeSQL @sql,
    N'@groupTable nvarchar(255), @groupTableCol nvarchar(255)',
    @groupTable=@groupTable, @groupTableCol=@groupTableCol;
  SET @sql = N'UPDATE '+ quotename(@equivTable) + N' set '+quotename(@equivTableCol)+
    N' = g.'+quotename(@groupTableCol)+N' from '+quotename(@equivTable)+' eqv left join '+
    quotename(@groupTable)+N' g on eqv.'+quotename(@equivTableCol)+
    N' = g.Name where g.'+quotename(@groupTableCol)+N' != ''"'';'
  EXEC sp_executeSQL @sql,
    N'@equivTable nvarchar(255), @equivTableCol nvarchar(255), @groupTable nvarchar(255), @groupTableCol nvarchar(255)',
	@equivTable=@equivTable, @equivTableCol=@equivTableCol, @groupTable=@groupTable, @groupTableCol=@groupTableCol;
END;
GO
EXEC apply_groups $(equivTable), 'SYSTEM_REV', 'SERO_SYSTEM', 'System_Rev';


-- Property column --
EXEC dup_column $(equivTable), 'PROPERTY', 'PROPERTY_REV'
GO
EXEC apply_groups $(equivTable), 'PROPERTY_REV', 'SERO_PROPERTY', 'Property_Rev';

-- METHOD column--
EXEC dup_column $(equivTable), 'METHOD_TYP', 'METHOD_REV'
GO
EXEC apply_groups $(equivTable), 'METHOD_REV', 'SERO_METHOD', 'Method_Rev';


-- Build the equivalance class name
ALTER TABLE $(equivTable) ADD EQUIV_CLS nvarchar(255);
GO
UPDATE $(equivTable) set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY_REV,'|',SYSTEM_REV,'|',METHOD_REV);

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
select EQUIV_CLS, LOINC_NUM, COMPONENT, PROPERTY, PROPERTY_REV, SYSTEM, SYSTEM_REV, METHOD_TYP, METHOD_REV
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From $(equivTable)) t  where CLS_COUNT > 1
  order by EQUIV_CLS
