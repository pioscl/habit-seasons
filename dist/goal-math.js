// Quantities are stored as JSON numbers, calculated in millionths to avoid decimal drift.
export const SCALE=1000000;
export function quantityUnits(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000000)return null;
 const units=Math.round(value*SCALE);
 return Number.isSafeInteger(units)&&units/SCALE===value?units:null;
}
export function goalProgress(goal){return goal.progressEvents.reduce((sum,event)=>sum+quantityUnits(event.value),0)/SCALE}
export function milestoneReached(goal,milestone){
 return BigInt(Math.round(goalProgress(goal)*SCALE))*100n*BigInt(SCALE)>=BigInt(quantityUnits(goal.targetValue))*BigInt(quantityUnits(milestone.percentage));
}
export function goalEarned(goal){
 return goal.milestones.reduce((sum,m)=>sum+(milestoneReached(goal,m)?m.points:0),0)+(goalProgress(goal)===goal.targetValue?goal.completionPoints:0);
}
export function goalPercent(goal){
 const current=goalProgress(goal);
 return current===goal.targetValue?100:Math.min(99.99,Math.floor(current/goal.targetValue*10000)/100);
}
