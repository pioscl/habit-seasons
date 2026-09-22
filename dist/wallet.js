import {goalEarned} from './goal-math.js';
export function earnedPoints(state){
 return state.checkins.reduce((sum,event)=>sum+event.points,0)+(state.goals||[]).reduce((sum,goal)=>sum+goalEarned(goal),0);
}
export function balance(state){return earnedPoints(state)-state.redemptions.reduce((sum,event)=>sum+event.cost,0)}
