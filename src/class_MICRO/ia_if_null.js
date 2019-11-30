/**
 *  Handles METHOD group IA-IF-Null*, which is also used by class SERO, for
 *  cases where METHOD_TYP is not set.
 *  SERO's documentation explicity says to use the same group defined in MICRO,
 *  and they are the only two classes to use it.
 *  This assumes the column METHOD_REV has already been created.
 * @param query the query function returned by util.js' sqlUtil function.
 * @param equivTable the name of the equivalence table being constructed.
 */
module.exports = async function applyIaIfNull(query, equivTable) {
  await query('UPDATE '+equivTable +" set METHOD_REV='IA-IF-Null*' where "+
    "(METHOD_TYP is null or METHOD_TYP = '') and "+
    "(COMPONENT like '%[+. ]A[bg]' or COMPONENT like '%[+. ]A[bg][+. ]%')");
}
