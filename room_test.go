package main

import "testing"

func TestRecordPlayCountsAndPersists(t *testing.T) {
	configDirOverride = t.TempDir()
	statsLoaded = nil
	t.Cleanup(func() { configDirOverride = ""; statsLoaded = nil })

	a := &App{}
	for i := 0; i < 3; i++ {
		if err := a.RecordPlay("album1"); err != nil {
			t.Fatal(err)
		}
	}
	a.RecordPlay("")
	if got := a.GetPlayStats()["album1"].Plays; got != 3 {
		t.Fatalf("plays = %d, want 3", got)
	}

	// Reload from disk
	statsLoaded = nil
	if got := a.GetPlayStats()["album1"].Plays; got != 3 {
		t.Fatalf("plays after reload = %d, want 3", got)
	}
	if _, ok := a.GetPlayStats()[""]; ok {
		t.Fatal("an empty album id should not be counted")
	}
}

func TestRoomsRoundTripAndRejectInvalidJSON(t *testing.T) {
	configDirOverride = t.TempDir()
	t.Cleanup(func() { configDirOverride = "" })

	a := &App{}
	if got, err := a.LoadRooms(); err != nil || got != "" {
		t.Fatalf("no rooms yet should give \"\", got %q, %v", got, err)
	}
	data := `{"version":1,"rooms":[{"id":"r1","name":"Den","items":[]}]}`
	if err := a.SaveRooms(data); err != nil {
		t.Fatal(err)
	}
	if got, _ := a.LoadRooms(); got != data {
		t.Fatalf("got %q", got)
	}
	if err := a.SaveRooms("{not json"); err == nil {
		t.Fatal("invalid JSON must be rejected")
	}
}
