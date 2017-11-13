-- Note:  This requires SQLCMD Mode to be turned on
:setvar equivTable 'MICRO_EQUIV'
:setvar orgCol 'OrganismGrouper'

-- Copy source table
EXEC create_equiv_table $(equivTable), 'MICRO'
GO

-- METHOD column
-- Create modified copies of columns rather than changing originals.
EXEC dup_column $(equivTable), 'METHOD_TYP', 'METHOD_TYP_REV';
GO
UPDATE MICRO_EQUIV set METHOD_TYP_REV=Grouper from MICRO_EQUIV left join MICRO_METHOD
  on MICRO_EQUIV.METHOD_TYP = MICRO_METHOD.Name where Grouper is not null;

-- Organism column --
EXEC add_column $(equivTable), $(orgCol)
GO
DECLARE @sql nvarchar(500);
SET @sql='UPDATE MICRO_EQUIV set '+quotename($(orgCol))+
 '=VeterinarySimple from MICRO_EQUIV
  inner join LOINC_DETAIL_TYPE_1
    on MICRO_EQUIV.LOINC_NUM = LOINC_DETAIL_TYPE_1.LOINC_NUM
  left join MICRO_ORGANISM
    on LOINC_DETAIL_TYPE_1.COMPONENT_PN = MICRO_ORGANISM.Part';
EXEC(@sql)

-- Scale column --
EXEC dup_column $(equivTable), 'SCALE_TYP', 'SCALE_TYP_REV';
GO
UPDATE MICRO_EQUIV set SCALE_TYP_REV=[Scale-NEW] from MICRO_EQUIV left join MICRO_SCALE
  on MICRO_EQUIV.LOINC_NUM = MICRO_SCALE.LOINC;

-- System column --
EXEC dup_column $(equivTable), 'SYSTEM', 'SYSTEM_REV'
GO
--UPDATE MICRO

