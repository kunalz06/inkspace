import {classifyPointer} from './input.js';
/** First candidate is accepted if classified as writing; additional contacts ignored. */
export function createPointerTracker({onStart,onMove,onEnd,onReject=()=>{},getOptions=()=>({})}){
  let active=null;const ignored=new Set();
  return {
    down(e){
      if(active!==null){ignored.add(e.pointerId);return false;}
      const decision=classifyPointer(e,getOptions());
      if(decision.action!=='accept'){ignored.add(e.pointerId);onReject(e,decision);return false;}
      active=e.pointerId;onStart(e);return true;
    },
    move(e){if(e.pointerId===active){onMove(e);return true;}return false;},
    up(e){ignored.delete(e.pointerId);if(e.pointerId===active){active=null;onEnd(e);return true;}return false;},
    reset(){active=null;ignored.clear();},
    get activeId(){return active;},
    get ignoredIds(){return new Set(ignored);}
  };
}
