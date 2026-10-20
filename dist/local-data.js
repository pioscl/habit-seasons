export const LOCAL_DATA_KEY='habit-seasons-v1';
export const HABIT_VIEW_KEY='habit-seasons-habit-view';

// Delete only this app's keys. Other same-origin storage may belong to other apps.
export function clearStoredData(storage,expectedRaw){
 const current=storage.getItem(LOCAL_DATA_KEY);
 if(current!==expectedRaw){
  const error=new Error('另一个页面更新了数据，请重新确认清除。');
  error.code='LOCAL_DATA_CHANGED';
  throw error;
 }
 const previousView=storage.getItem(HABIT_VIEW_KEY);
 storage.removeItem(HABIT_VIEW_KEY);
 try{
  storage.removeItem(LOCAL_DATA_KEY);
 }catch(error){
  // Keep the main record intact if deletion fails, and restore its preference.
  if(previousView!==null){try{storage.setItem(HABIT_VIEW_KEY,previousView)}catch{}}
  throw error;
 }
}
