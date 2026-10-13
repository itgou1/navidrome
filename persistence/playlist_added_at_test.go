package persistence

import (
	"context"
	"time"

	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Playlist addition times", func() {
	var ctx context.Context
	var playlists model.PlaylistRepository
	var tracks model.PlaylistTrackRepository
	var pls model.Playlist
	before := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

	BeforeEach(func() {
		ctx = request.WithUser(GinkgoT().Context(), model.User{ID: "userid", IsAdmin: true})
		playlists = NewPlaylistRepository(GetDBXBuilder())
		pls = model.Playlist{Name: "Addition times", OwnerID: "userid"}
		Expect(playlists.Put(ctx, &pls)).To(Succeed())
		DeferCleanup(func() { Expect(playlists.Delete(ctx, pls.ID)).To(Succeed()) })
		tracks = playlists.Tracks(ctx, pls.ID, false)
	})

	list := func(sort, order string) model.PlaylistTracks {
		rows, err := tracks.GetAll(ctx, model.QueryOptions{Sort: sort, Order: order})
		Expect(err).ToNot(HaveOccurred())
		return rows
	}
	setTime := func(position int, value any) {
		_, err := GetDBXBuilder().NewQuery("UPDATE playlist_tracks SET added_at={:time} WHERE playlist_id={:playlist} AND id={:id}").
			Bind(map[string]any{"time": value, "playlist": pls.ID, "id": position}).Execute()
		Expect(err).ToNot(HaveOccurred())
	}

	It("timestamps additions, preserves them on reorder, and renews them on re-add", func() {
		start := time.Now().Add(-time.Second)
		Expect(tracks.Add(ctx, []string{songDayInALife.ID, songRadioactivity.ID})).To(Equal(2))
		rows := list("id", "asc")
		Expect(rows[0].AddedAt).ToNot(BeNil())
		Expect(*rows[0].AddedAt).To(BeTemporally(">=", start))
		setTime(1, before)
		Expect(tracks.Reorder(ctx, 1, 2)).To(Succeed())
		rows = list("id", "asc")
		Expect(*rows[1].AddedAt).To(BeTemporally("==", before))
		Expect(tracks.Delete(ctx, "2")).To(Succeed())
		Expect(tracks.Add(ctx, []string{songDayInALife.ID})).To(Equal(1))
		Expect(*list("id", "asc")[1].AddedAt).To(BeTemporally(">", before))
	})

	It("sorts addition times in both directions with stable pagination and unknown legacy times", func() {
		Expect(tracks.Add(ctx, []string{songDayInALife.ID, songRadioactivity.ID, songDayInALife.ID})).To(Equal(3))
		setTime(1, before)
		setTime(2, nil)
		setTime(3, before.Add(time.Hour))
		rows := list("addedAt", "desc")
		Expect([]string{rows[0].ID, rows[1].ID, rows[2].ID}).To(Equal([]string{"3", "1", "2"}))
		rows = list("addedAt", "asc")
		Expect([]string{rows[0].ID, rows[1].ID, rows[2].ID}).To(Equal([]string{"2", "1", "3"}))
		page, err := tracks.GetAll(ctx, model.QueryOptions{Sort: "addedAt", Order: "desc", Max: 1, Offset: 1})
		Expect(err).ToNot(HaveOccurred())
		Expect(page[0].ID).To(Equal("1"))
		setTime(3, before)
		Expect(list("addedAt", "desc")[0].ID).To(Equal("3"))
	})

	It("preserves duplicate and unknown times through full replacement and gives new entries new times", func() {
		Expect(tracks.Add(ctx, []string{songDayInALife.ID, songDayInALife.ID, songRadioactivity.ID})).To(Equal(3))
		setTime(1, before)
		setTime(2, before.Add(time.Hour))
		setTime(3, nil)
		pls.AddMediaFilesByID([]string{songRadioactivity.ID, songDayInALife.ID, songDayInALife.ID, songDayInALife.ID})
		Expect(playlists.Put(ctx, &pls)).To(Succeed())
		rows := list("id", "asc")
		Expect(rows[0].AddedAt).To(BeNil())
		Expect(*rows[1].AddedAt).To(BeTemporally("==", before))
		Expect(*rows[2].AddedAt).To(BeTemporally("==", before.Add(time.Hour)))
		Expect(*rows[3].AddedAt).To(BeTemporally(">", before.Add(time.Hour)))
	})

	It("keeps existing times when inserting before them", func() {
		Expect(tracks.Add(ctx, []string{songDayInALife.ID})).To(Equal(1))
		setTime(1, before)
		Expect(tracks.Insert(ctx, []string{songRadioactivity.ID}, 1)).To(Equal(1))
		rows := list("id", "asc")
		Expect(*rows[0].AddedAt).To(BeTemporally(">", before))
		Expect(*rows[1].AddedAt).To(BeTemporally("==", before))
	})
})
