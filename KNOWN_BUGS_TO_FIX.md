# Known Bugs - Must Fix Before Beta Testing

## 🔴 Critical Bugs

### 1. First Caller Cannot Hear Conference Audio
**Status**: Testing fix after current deployment
**Issue**: First caller hears silence until cycled through on-air/hold
**Attempted Fix**: Connect host to conference after opener finishes
**Test**: Deploy is building now, will test in 2 minutes

### 2. Chat Overflow - Growing Vertically
**Status**: NOT FIXED (multiple attempts failed)
**Issue**: Chat panel grows vertically, pushes content down, requires scrolling
**Attempts Made**:
- Added overflow-hidden to parent containers (no effect)
- Added overflow-hidden to ChatPanel itself (no effect)
- Redesigned with max-height calc() (no effect)
- Added flex-shrink-0 to header/form (no effect)

**Why It's Not Working**: Changes might not be deploying to frontend, or browser cache is extreme

**Next Approach Needed**: Different strategy entirely

---

## 🟡 Medium Priority Issues

### 3. Host Cannot Hear Show Opener
**Status**: REVERTED (caused feedback)
**Issue**: Host wants to hear opener in headphones
**Problem**: Enabling local playback causes feedback loop with mic
**Need**: Selective playback - only opener/soundboard, not mic

---

## 🟢 Low Priority / Nice to Have

### 4. Chat Features Removed
**Status**: Intentionally simplified
**Issue**: SMS reply and file upload removed for simplification
**Decision**: Keep simplified for now, can add back later if needed

---

## 📋 Fix Strategy

### For Chat (Bug #2):
**Option A**: Complete redesign with different layout approach
**Option B**: Use a modal/popup for chat instead of sidebar
**Option C**: Fixed-height chat with explicit pixel values instead of flex
**Option D**: Disable chat temporarily, re-enable after beta testing

### For Opener Audio (Bug #3):
**Option A**: Create separate audio element for opener (bypass mixer)
**Option B**: Mute mic source during opener, unmute after
**Option C**: Accept host doesn't hear opener (not critical)

---

## 🎯 Priority Order

1. **Fix first-caller issue** (testing now)
2. **Fix chat overflow** (choose approach and implement)
3. **Fix host hearing opener** (if critical, otherwise defer)

---

**All bugs must be resolved before beta testing begins.**

