-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable "MICRO_EQUIV"
:setvar orgCol "OrganismGrouper"
:setvar systemGroupCol "SystemGrouper"
:setvar methodGroupCol "MicroMethodGrouper"
:setvar propertyGroup "PrAcncTitr"

-- Copy source table
EXEC create_equiv_table $(equivTable), 'MICRO'
GO

-- Organism column --
-- For now Clem says to skip this one.
/*
EXEC add_column $(equivTable), $(orgCol)
GO
DECLARE @sql nvarchar(500);
SET @sql='UPDATE MICRO_EQUIV set '+quotename($(orgCol))+
 '=VeterinarySimple from MICRO_EQUIV
  inner join LOINC_DETAIL_TYPE_1
    on MICRO_EQUIV.LOINC_NUM = LOINC_DETAIL_TYPE_1.LOINC_NUM
  left join MICRO_ORGANISM
    on LOINC_DETAIL_TYPE_1.COMPONENTCORE_PN = MICRO_ORGANISM.Part';
EXEC(@sql)
*/

-- Scale column --
/*  Clem said this one which collapses Ord and Qn is not useful because no
 *  groups are created.
EXEC dup_column $(equivTable), 'SCALE_TYP', 'SCALE_TYP_REV';
GO
UPDATE MICRO_EQUIV set SCALE_TYP_REV=[Scale-NEW] from MICRO_EQUIV left join MICRO_SCALE
  on MICRO_EQUIV.LOINC_NUM = MICRO_SCALE.LOINC;
*/

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
-- Clean up the system grouping table before using it.  (This only has to run
-- once, but it won't hurt to leave it in case we reload the table.)
UPDATE MICRO_SYSTEM set $(systemGroupCol) = RTRIM(LTRIM($(systemGroupCol))); -- there was a case of ' "'
UPDATE MICRO_SYSTEM set $(systemGroupCol) = null where $(systemGroupCol) = '"' or $(systemGroupCol) = '?'
UPDATE MICRO_SYSTEM set $(systemGroupCol) = 'VM' where $(systemGroupCol) = 'VM?'
-- Now use the system table to update SYSTEM_REV in the equivalence table.
UPDATE $(equivTable) set SYSTEM_REV = $(systemGroupCol) from
 $(equivTable) eqv left join MICRO_SYSTEM on eqv.SYSTEM = MICRO_SYSTEM.Name
 left join LOINC_DETAIL_TYPE_1 ltd on eqv.LOINC_NUM = ltd.LOINC_NUM
 left join MICRO_STD_ComponentCore std on ltd.COMPONENTCORE_PN = std.Part
 where $(systemGroupCol) is not null and (($(systemGroupCol) not in ('AnalRectalStool', 'UrineUrethra'))
 or (std.STDGrouper is not null));

-- Property column --
EXEC dup_column $(equivTable), 'PROPERTY', 'PROPERTY_REV'
GO
UPDATE $(equivTable) set PROPERTY_REV = '$(propertyGroup)' where PROPERTY in ('PrThr', 'ACnc', 'Titr');

-- METHOD column--
-- Depends on Property change above --
-- Create modified copies of columns rather than changing originals.
EXEC dup_column $(equivTable), 'METHOD_TYP', 'METHOD_TYP_REV';
GO
UPDATE $(equivTable) set METHOD_TYP_REV=$(methodGroupCol) from $(equivTable) left join MICRO_METHOD
  on $(equivTable).METHOD_TYP = MICRO_METHOD.Name where $(methodGroupCol) is not null;
UPDATE $(equivTable) set METHOD_TYP_REV='IA_EIA_IF_RIA_null' where PROPERTY_REV='$(propertyGroup)' and
  (METHOD_TYP_REV is null or METHOD_TYP_REV = '') and
  (COMPONENT like '%[+. ]A[bg]' or COMPONENT like '%[+. ]A[bg][+. ]%')

-- Build the equivalance class name
ALTER TABLE $(equivTable) ADD EQUIV_CLS nvarchar(255);
GO
UPDATE $(equivTable) set EQUIV_CLS=CONCAT(COMPONENT,'|',PROPERTY_REV,'|',SYSTEM_REV,'|',METHOD_TYP_REV);

-- Sample output, paritioning by the equivalence class for counts and to remove entries with a count of 1
select EQUIV_CLS, LOINC_NUM, COMPONENT, PROPERTY, PROPERTY_REV, SYSTEM, SYSTEM_REV, METHOD_TYP, METHOD_TYP_REV
  from (select *, count(EQUIV_CLS) over(partition by EQUIV_CLS) as CLS_COUNT From $(equivTable)) t  where CLS_COUNT > 1
  order by EQUIV_CLS
