package Type

import "madcraft.io/madcraft/Struct"

type (
	Mob struct {
		World      *World                   `json:"-"`
		ID         string                   `json:"id"` // уникальный GUID
		Name       *string                  `json:"name"`
		Type       string                   `json:"type"`
		Skin       string                   `json:"skin"`
		Pos        Struct.Vector3f          `json:"pos"`
		Rotate     Struct.Vector3f          `json:"rotate"`
		Indicators *Struct.PlayerIndicators `json:"indicators"`
	}
)

func (this *Mob) Init() {
}
