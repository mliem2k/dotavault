package main

import (
	"bytes"
	"compress/bzip2"
	"io"
	"os"
	"testing"

	"github.com/klauspost/compress/zstd"
)

func TestDecompressReplay_Bzip2(t *testing.T) {
	f, err := os.Open("testdata/fixture.dem.bz2")
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	defer f.Close()

	want, err := io.ReadAll(bzip2.NewReader(f))
	if err != nil {
		t.Fatalf("decompress fixture directly: %v", err)
	}

	f2, err := os.Open("testdata/fixture.dem.bz2")
	if err != nil {
		t.Fatalf("reopen fixture: %v", err)
	}
	defer f2.Close()

	r, err := decompressReplay(f2)
	if err != nil {
		t.Fatalf("decompressReplay: %v", err)
	}
	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read decompressed: %v", err)
	}

	if !bytes.Equal(got, want) {
		t.Errorf("decompressed bytes differ from direct bzip2.NewReader output (len got=%d want=%d)", len(got), len(want))
	}
}

func TestDecompressReplay_Zstd(t *testing.T) {
	want := []byte("dotavault replay-parser zstd fixture payload")

	var compressed bytes.Buffer
	enc, err := zstd.NewWriter(&compressed)
	if err != nil {
		t.Fatalf("create zstd writer: %v", err)
	}
	if _, err := enc.Write(want); err != nil {
		t.Fatalf("write zstd payload: %v", err)
	}
	if err := enc.Close(); err != nil {
		t.Fatalf("close zstd writer: %v", err)
	}

	r, err := decompressReplay(bytes.NewReader(compressed.Bytes()))
	if err != nil {
		t.Fatalf("decompressReplay: %v", err)
	}
	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read decompressed: %v", err)
	}

	if !bytes.Equal(got, want) {
		t.Errorf("decompressed = %q, want %q", got, want)
	}
}
