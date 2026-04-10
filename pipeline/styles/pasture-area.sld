<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld
    http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>pasture-area</Name>
    <UserStyle>
      <Title>MapBiomas Col. 10 — Área de Pastagem</Title>
      <Abstract>Classificação binária de pastagem cultivada. 0 = sem dados, 1 = pastagem.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Name>nodata</Name>
          <Title>Sem dados</Title>
          <RasterSymbolizer>
            <ChannelSelection>
              <GrayChannel>
                <SourceChannelName>1</SourceChannelName>
              </GrayChannel>
            </ChannelSelection>
            <ColorMap type="values">
              <ColorMapEntry color="#00000000" quantity="0" label="Sem dados" opacity="0"/>
              <ColorMapEntry color="#E8D74C" quantity="1" label="Pastagem" opacity="1"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
