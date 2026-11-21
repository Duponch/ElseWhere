/** Beds share roles, reservations and physical sleep services. */
export const isBedKind=(value:unknown):value is 'bedroll'|'bed'|'hospital-bed'|'double-bed'|'sleeping-spot'|'double-bedroll'|'double-sleeping-spot'=>value==='sleeping-spot'||value==='bedroll'||value==='bed'||value==='hospital-bed'||value==='double-bed'||value==='double-bedroll'||value==='double-sleeping-spot';
/** Schema 363: the double bedroll and the double sleeping spot have the double
 * bed's two independent slots (Core SleepingSlotsCount from a 2-wide size). */
export const isDoubleBedKind=(value:unknown):value is 'double-bed'|'double-bedroll'|'double-sleeping-spot'=>value==='double-bed'||value==='double-bedroll'||value==='double-sleeping-spot';
/** Ground sleeping spots: no construction, quality or hit points (SleepingSpotBase). */
export const isGroundSleepingSpotKind=(value:unknown):value is 'sleeping-spot'|'double-sleeping-spot'=>value==='sleeping-spot'||value==='double-sleeping-spot';
/** Bedrolls: Standable, Fabric/Leathery, laid on the floor (Bedroll, BedrollDouble). */
export const isBedrollKind=(value:unknown):value is 'bedroll'|'double-bedroll'=>value==='bedroll'||value==='double-bedroll';
