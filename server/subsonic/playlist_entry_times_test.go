package subsonic

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"time"

	"github.com/navidrome/navidrome/core/playlists"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/criteria"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

type playlistEntryTimesStub struct {
	playlists.Playlists
	items map[string]*model.Playlist
}

func (s *playlistEntryTimesStub) GetWithTracks(_ context.Context, id string) (*model.Playlist, error) {
	return s.items[id], nil
}

func (s *playlistEntryTimesStub) Create(_ context.Context, id, _ string, _ []string) (string, error) {
	if id == "" {
		id = "one"
	}
	return id, nil
}

var _ = Describe("GetPlaylist entry addition times", func() {
	var router *Router
	var service *playlistEntryTimesStub
	var song model.MediaFile
	var first, second time.Time

	BeforeEach(func() {
		first = time.Date(2026, 10, 13, 11, 55, 0, 0, time.FixedZone("UTC+8", 8*60*60))
		second = first.Add(24 * time.Hour)
		song = model.MediaFile{ID: "same-song", Title: "Same song", CreatedAt: first.Add(-365 * 24 * time.Hour)}
		service = &playlistEntryTimesStub{items: map[string]*model.Playlist{
			"one": {ID: "one", Tracks: model.PlaylistTracks{
				{ID: "1", MediaFile: song, AddedAt: &first},
				{ID: "2", MediaFile: song, AddedAt: &second},
				{ID: "3", MediaFile: song},
			}},
			"two": {ID: "two", Tracks: model.PlaylistTracks{{ID: "1", MediaFile: song, AddedAt: &second}}},
		}}
		router = New(&tests.MockDataStore{}, nil, nil, nil, nil, nil, nil, nil, service, nil, nil, nil, nil, nil, nil, nil)
	})

	It("uses each playlist occurrence rather than the song's library timestamp", func() {
		one, err := router.GetPlaylist(newGetRequest("id=one"))
		Expect(err).ToNot(HaveOccurred())
		two, err := router.GetPlaylist(newGetRequest("id=two"))
		Expect(err).ToNot(HaveOccurred())
		Expect(one.Playlist.Entry).To(HaveLen(3))
		Expect(one.Playlist.SupportsAddedAt).To(BeTrue())
		Expect(two.Playlist.SupportsAddedAt).To(BeTrue())
		Expect(one.Playlist.Entry[0].Id).To(Equal(song.ID))
		Expect(one.Playlist.Entry[0].AddedAt).To(Equal(&first))
		Expect(one.Playlist.Entry[1].AddedAt).To(Equal(&second))
		Expect(one.Playlist.Entry[2].AddedAt).To(BeNil())
		Expect(two.Playlist.Entry[0].Id).To(Equal(song.ID))
		Expect(two.Playlist.Entry[0].AddedAt).To(Equal(&second))
		Expect(one.Playlist.Entry[0].Created).To(Equal(childFromMediaFile(context.Background(), song).Created))
		Expect(one.Playlist.Entry[0].AddedAt).ToNot(Equal(one.Playlist.Entry[0].Created))
	})

	It("serializes optional addedAt in JSON and XML, omitting unknown historical times", func() {
		response, err := router.GetPlaylist(newGetRequest("id=one"))
		Expect(err).ToNot(HaveOccurred())
		data, err := json.Marshal(response.Playlist)
		Expect(err).ToNot(HaveOccurred())
		var jsonPlaylist struct {
			SupportsAddedAt *bool            `json:"supportsAddedAt"`
			Entry           []map[string]any `json:"entry"`
		}
		Expect(json.Unmarshal(data, &jsonPlaylist)).To(Succeed())
		Expect(jsonPlaylist.SupportsAddedAt).ToNot(BeNil())
		Expect(*jsonPlaylist.SupportsAddedAt).To(BeTrue())
		Expect(jsonPlaylist.Entry[0]).To(HaveKeyWithValue("addedAt", first.Format(time.RFC3339)))
		Expect(jsonPlaylist.Entry[1]).To(HaveKeyWithValue("addedAt", second.Format(time.RFC3339)))
		Expect(jsonPlaylist.Entry[2]).ToNot(HaveKey("addedAt"))

		data, err = xml.Marshal(response.Playlist)
		Expect(err).ToNot(HaveOccurred())
		var xmlPlaylist struct {
			SupportsAddedAt *bool `xml:"supportsAddedAt,attr"`
			Entry           []struct {
				AddedAt *string `xml:"addedAt,attr"`
			} `xml:"entry"`
		}
		Expect(xml.Unmarshal(data, &xmlPlaylist)).To(Succeed())
		Expect(xmlPlaylist.SupportsAddedAt).ToNot(BeNil())
		Expect(*xmlPlaylist.SupportsAddedAt).To(BeTrue())
		Expect(xmlPlaylist.Entry[0].AddedAt).ToNot(BeNil())
		Expect(*xmlPlaylist.Entry[0].AddedAt).To(Equal(first.Format(time.RFC3339)))
		Expect(*xmlPlaylist.Entry[1].AddedAt).To(Equal(second.Format(time.RFC3339)))
		Expect(xmlPlaylist.Entry[2].AddedAt).To(BeNil())
	})

	DescribeTable("always declares capability independently of entry timestamps",
		func(smart bool, times []bool) {
			playlist := &model.Playlist{ID: "case"}
			if smart {
				playlist.Rules = &criteria.Criteria{Expression: criteria.All{criteria.Contains{"title": "song"}}}
			}
			for _, known := range times {
				track := model.PlaylistTrack{MediaFile: song}
				if known {
					track.AddedAt = &first
				}
				playlist.Tracks = append(playlist.Tracks, track)
			}
			service.items["case"] = playlist
			response, err := router.GetPlaylist(newGetRequest("id=case"))
			Expect(err).ToNot(HaveOccurred())
			data, err := json.Marshal(response.Playlist)
			Expect(err).ToNot(HaveOccurred())
			var decoded map[string]any
			Expect(json.Unmarshal(data, &decoded)).To(Succeed())
			Expect(decoded).To(HaveKeyWithValue("supportsAddedAt", !smart))
			for i, entry := range response.Playlist.Entry {
				if smart || !times[i] {
					Expect(entry.AddedAt).To(BeNil())
				}
			}
			data, err = xml.Marshal(response.Playlist)
			Expect(err).ToNot(HaveOccurred())
			if smart {
				Expect(string(data)).To(ContainSubstring(`supportsAddedAt="false"`))
				Expect(string(data)).ToNot(ContainSubstring(` addedAt=`))
			} else {
				Expect(string(data)).To(ContainSubstring(`supportsAddedAt="true"`))
			}
		},
		Entry("ordinary playlist", false, []bool{true}),
		Entry("empty playlist", false, []bool{}),
		Entry("unknown historical times", false, []bool{false, false}),
		Entry("smart playlist with generated timestamps", true, []bool{true, false}),
		Entry("empty smart playlist", true, []bool{}),
	)

	It("returns the same full details when creating or replacing a playlist", func() {
		for _, query := range []string{"name=New&songId=same-song", "playlistId=one&songId=same-song"} {
			response, err := router.CreatePlaylist(newGetRequest(query))
			Expect(err).ToNot(HaveOccurred())
			expected, err := router.GetPlaylist(newGetRequest("id=one"))
			Expect(err).ToNot(HaveOccurred())
			Expect(response.Playlist).To(Equal(expected.Playlist))
			Expect(response.Playlist.SupportsAddedAt).To(BeTrue())
			Expect(response.Playlist.Entry[0].AddedAt).To(Equal(&first))
		}
	})

	It("does not add a playlist timestamp to ordinary song responses", func() {
		entry := childFromMediaFile(context.Background(), song)
		Expect(entry.AddedAt).To(BeNil())
		data, err := json.Marshal(entry)
		Expect(err).ToNot(HaveOccurred())
		Expect(string(data)).ToNot(ContainSubstring("addedAt"))
	})
})
